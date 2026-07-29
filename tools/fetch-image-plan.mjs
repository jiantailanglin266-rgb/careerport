// image-plan.mjs の全キーを Commons から取得し images/kv/ に保存、クレジットを images.json に記録
// 使い方:
//   node tools/fetch-image-plan.mjs               … 未取得キーのみ取得
//   node tools/fetch-image-plan.mjs cat:occ_it 2  … 指定キーを候補#2で強制再取得（目視NG時の差し替え）
// 規約: 取得後は必ず全画像を目視検証すること（data-sourcing.md）。ライセンス不明は自動スキップ。
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const UA = { "User-Agent": "CAREERPORT-image/1.0 (contact: jiantailanglin266@gmail.com)" };
const API = "https://commons.wikimedia.org/w/api.php";
const OUT = join(ROOT, "tools", "data", "images.json");
const PLAN = (await import(pathToFileURL(join(ROOT, "tools", "image-plan.mjs")).href)).default;

const [filterKey, candArg] = process.argv.slice(2);
const candIdx = candArg ? Number(candArg) : 0;
const manifest = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf-8")) : {};
const strip = (s) => String(s || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
const BAD = /logo|map|icon|diagram|flag|seal|chart|svg|coat|banner|screenshot|emblem|sign\b|plaque|cover|poster|stamp|drawing/i;
const keyFile = (k) => k.replace(/[:]/g, "-") + ".jpg";

async function api(params) {
  const res = await fetch(API + "?format=json&" + params, { headers: UA });
  if (!res.ok) throw new Error("api " + res.status);
  return res.json();
}
async function candidates(q) {
  const j = await api(`action=query&list=search&srnamespace=6&srlimit=40&srsearch=${encodeURIComponent(q + " filetype:bitmap")}`);
  return j.query.search.map((r) => r.title).filter((t) => /\.jpe?g$/i.test(t) && !BAD.test(t));
}
async function fetchFile(title, dest) {
  const j = await api(`action=query&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=1400&titles=${encodeURIComponent(title)}`);
  const page = Object.values(j.query.pages)[0];
  if (!page?.imageinfo) return null;
  const ii = page.imageinfo[0];
  if ((ii.width || 0) < 800) return null;                       // 小さすぎる画像は除外
  const md = ii.extmetadata || {};
  const license = strip(md.LicenseShortName?.value);
  if (!license) return null;                                     // ライセンス不明は使わない
  const artist = strip(md.Artist?.value) || "作者不明";
  const img = await fetch(ii.thumburl || ii.url, { headers: UA });
  if (!img.ok) return null;
  const buf = Buffer.from(await img.arrayBuffer());
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, buf);
  const pd = /public domain|^pd|cc0/i.test(license);
  return {
    file: title,
    credit: pd ? `Photo: ${artist} / Wikimedia Commons, ${/cc0/i.test(license) ? "CC0" : "Public Domain"}`
               : `Photo: ${artist} / Wikimedia Commons, ${license}`,
    page: ii.descriptionurl || "",
  };
}

// alias は実体キーの画像を共有するため取得しない（seed.mjs が解決する）
const keys = Object.keys(PLAN).filter((k) => !PLAN[k].alias && (filterKey ? k === filterKey : !manifest[k]));
if (!keys.length) { console.log("取得対象なし（全キー取得済み。差し替えは key と候補番号を指定）"); process.exit(0); }
for (const key of keys) {
  const plan = PLAN[key];
  const dest = join(ROOT, "images", "kv", keyFile(key));
  try {
    let picked = null;
    if (plan.file) {
      picked = await fetchFile(plan.file, dest);
    } else {
      const cands = await candidates(plan.q);
      for (let i = candIdx; i < cands.length && !picked; i++) picked = await fetchFile(cands[i], dest);
    }
    if (!picked) { console.log(`✗ ${key}: 候補なし（クエリ調整 or file指定を）`); continue; }
    manifest[key] = { src: "images/kv/" + keyFile(key), ...picked };
    console.log(`✓ ${key} ← ${picked.file}`);
  } catch (e) { console.log(`✗ ${key}: ${e.message}`); }
  await new Promise((r) => setTimeout(r, 400));                  // Commons への礼儀としてスペーシング
}
writeFileSync(OUT, JSON.stringify(manifest, null, 1), "utf-8");
console.log(`OK: ${Object.keys(manifest).length}/${Object.keys(PLAN).length} keys in images.json — 次: 全画像を目視検証`);
