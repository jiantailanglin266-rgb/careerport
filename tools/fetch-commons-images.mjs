// Wikimedia Commons 画像パイプライン（検索 → メタデータ → ダウンロード）
// 使い方:
//   node tools/fetch-commons-images.mjs search "富岡製糸場"          … 候補ファイルを列挙
//   node tools/fetch-commons-images.mjs get "File:Xxx.jpg" images/articles/foo.jpg [width]
//        … 指定ファイルをダウンロードし、作者・ライセンス（クレジット文）を表示
// 規約（data-sourcing.md 準拠）:
//   1. ダウンロード後は必ず目視検証する（検索結果は被写体違いが頻発する）
//   2. キャプションに「Photo: <作者> / Wikimedia Commons, <ライセンス>」を必ず表示する
//   3. ライセンスが確認できないファイルは使わない
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const UA = { "User-Agent": "CAREERPORT-image/1.0 (contact: jiantailanglin266@gmail.com)" };
const API = "https://commons.wikimedia.org/w/api.php";

const [cmd, arg1, arg2, arg3] = process.argv.slice(2);
const strip = (s) => String(s || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

if (cmd === "search") {
  const res = await fetch(`${API}?action=query&format=json&list=search&srnamespace=6&srlimit=20&srsearch=${encodeURIComponent(arg1)}`, { headers: UA });
  const j = await res.json();
  for (const r of j.query.search) console.log(r.title);
} else if (cmd === "get") {
  const res = await fetch(`${API}?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=${arg3 || 1400}&titles=${encodeURIComponent(arg1)}`, { headers: UA });
  const j = await res.json();
  const page = Object.values(j.query.pages)[0];
  if (!page || !page.imageinfo) throw new Error("file not found: " + arg1);
  const ii = page.imageinfo[0];
  const md = ii.extmetadata || {};
  const artist = strip(md.Artist?.value) || "不明";
  const license = strip(md.LicenseShortName?.value) || "";
  if (!license) throw new Error("ライセンス不明のため使用不可: " + arg1);
  const imgRes = await fetch(ii.thumburl || ii.url, { headers: UA });
  if (!imgRes.ok) throw new Error("download failed " + imgRes.status);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const dest = join(ROOT, arg2);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, buf);
  const pd = /public domain|pd/i.test(license);
  console.log("saved:", arg2, `(${Math.round(buf.length / 1024)}KB, ${ii.thumbwidth || ii.width}px)`);
  console.log("credit:", pd ? `Photo: ${artist} / Wikimedia Commons, Public Domain` : `Photo: ${artist} / Wikimedia Commons, ${license}`);
  console.log("page:", ii.descriptionurl || "");
  console.log("※必ず画像を目視検証してから使用すること");
} else {
  console.log('usage: search "<query>" | get "File:X.jpg" <dest> [width]');
}
