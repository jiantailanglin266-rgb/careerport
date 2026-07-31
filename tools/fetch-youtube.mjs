// 公式YouTube動画の検証・取り込み
//
// 使い方:
//   node tools/fetch-youtube.mjs                 … tools/data/youtube-ids.json を全件検証
//   node tools/fetch-youtube.mjs --recheck       … 既存分も含めて再検証（リンク切れ検知）
//
// 方針:
//   - 動画は YouTube 公式の埋め込みプレーヤーで表示する（ダウンロード・再ホストはしない）
//   - タイトルとチャンネル名は「捏造しない」。必ず YouTube 公式の oEmbed API から取得する
//     （APIキー不要の公開エンドポイント。ここで404になるID＝非公開/削除済みは自動で除外）
//   - 掲載対象は公的機関の公式チャンネルに限定する（ALLOW/DENY で判定）
//   - 取得できたものだけ tools/data/videos.json に書き出し、seed.mjs が data.js に載せる
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC = join(ROOT, "tools", "data", "youtube-ids.json");
const OUT = join(ROOT, "tools", "data", "videos.json");
const UA = { "User-Agent": "CAREERPORT-video/1.0 (contact: jiantailanglin266@gmail.com)" };

// 掲載を許可するチャンネル（公的機関）。民間・個人チャンネルは掲載しない。
const ALLOW = /厚生労働省|労働局|ハローワーク|県公式|Tokyo Metropolitan|東京都|区公式|市公式|市動画|独立行政法人|JILPT|政府広報オンライン|tsulunos|ポリテク|みえハロTube|自営型テレワーク|新卒応援ハローワーク/;
const DENY  = /社労士|事務所|Kaien|放送|医師会|さんぽLAB/;

const recheck = process.argv.includes("--recheck");

async function oembed(id) {
  const url = "https://www.youtube.com/oembed?format=json&url=" +
    encodeURIComponent("https://www.youtube.com/watch?v=" + id);
  const res = await fetch(url, { headers: UA });
  if (!res.ok) return null;                      // 404 = 削除・非公開・埋め込み不可
  const d = await res.json();
  return {
    id,
    title: String(d.title || "").trim(),
    channel: String(d.author_name || "").trim(),
    channelUrl: String(d.author_url || ""),
    thumb: String(d.thumbnail_url || ""),
    width: d.width, height: d.height,
  };
}

const ids = JSON.parse(readFileSync(SRC, "utf-8"));
const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf-8")) : [];
const prevById = Object.fromEntries(prev.map((v) => [v.id, v]));

const out = [];
const rejected = [];
let checked = 0;

for (const entry of ids) {
  const id = typeof entry === "string" ? entry : entry.id;
  const topic = typeof entry === "string" ? "" : (entry.topic || "");
  if (!recheck && prevById[id]) { out.push({ ...prevById[id], topic: topic || prevById[id].topic }); continue; }
  let v = null;
  try { v = await oembed(id); } catch { v = null; }
  checked++;
  if (!v) { rejected.push({ id, why: "oEmbedで取得できない（削除・非公開・埋め込み不可）" }); continue; }
  if (!ALLOW.test(v.channel) || DENY.test(v.channel)) {
    rejected.push({ id, why: "公的機関の公式チャンネルではない: " + v.channel });
    continue;
  }
  out.push({ ...v, topic });
  process.stdout.write(".");
  await new Promise((r) => setTimeout(r, 120));   // YouTube への礼儀
}

mkdirSync(dirname(OUT), { recursive: true });
// チャンネル→タイトルの安定ソート（同じチャンネルの動画がまとまるように）
out.sort((a, b) => a.channel.localeCompare(b.channel, "ja") || a.title.localeCompare(b.title, "ja"));
writeFileSync(OUT, JSON.stringify(out, null, 1), "utf-8");

console.log(`\nOK: 掲載 ${out.length} 本（新規検証 ${checked} 本）／除外 ${rejected.length} 本 -> tools/data/videos.json`);
if (rejected.length) {
  const byWhy = {};
  rejected.forEach((r) => { byWhy[r.why] = (byWhy[r.why] || 0) + 1; });
  Object.entries(byWhy).forEach(([w, n]) => console.log(`  ${String(n).padStart(3)} 本  ${w}`));
}
const channels = [...new Set(out.map((v) => v.channel))];
console.log(`チャンネル数: ${channels.length}`);
console.log("次: node tools/seed.mjs → index.html の data.js?v= バンプ → node build.mjs");
