// 記事一括登録 — scratchpad ESM の記事配列を tools/data/articles-extra.json に追記する
// 実行: node tools/register-articles.mjs <path/to/art-batch.mjs>
//
// 入力ファイル形式（ESM・default export が配列）:
//   export default [
//     { slug:"...", category:"start|resignation|resume|career-history|interview|salary-negotiation|unemployment|career|reskilling|story",
//       publishedAt:[2026,8,1],              // Date.UTC 用の [年,月,日]（Date.now() は使わない=再現性のため）
//       ja:{ title:"...", metaDesc:"...", body:"...（artBody マイクロ記法）" },
//       sources:[{title,url,note}],          // 任意（story は必須）
//       supervisorName:"..."                 // 任意
//     }, ...
//   ]
// 規約:
//   - 登録時の status は必ず "draft"。人間が内容確認後に articles-extra.json 上で
//     "published" へ変更する（AI下書きの自動公開禁止 / fact-policy）
//   - slug 重複はスキップ。story カテゴリで sources が無い場合はエラー
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath, pathToFileURL } from "url";
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, "tools", "data", "articles-extra.json");

const src = process.argv[2];
if (!src) { console.error("usage: node tools/register-articles.mjs <art-batch.mjs>"); process.exit(1); }
const batch = (await import(pathToFileURL(resolve(src)).href)).default;
if (!Array.isArray(batch)) throw new Error("default export が配列ではありません");

const CATS = ["start", "resignation", "resume", "career-history", "interview", "salary-negotiation", "unemployment", "career", "reskilling", "story"];
const existing = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf-8")) : [];
const dataSrc = readFileSync(join(ROOT, "data.js"), "utf-8");
const DATA = JSON.parse(dataSrc.match(/^var DATA=(.*);$/m)[1]);
const seen = new Set([...existing.map((a) => a.slug), ...DATA.articles.map((a) => a.slug)]);

let added = 0, skipped = 0;
for (const a of batch) {
  if (!a.slug || !a.ja?.title || !a.ja?.body || !CATS.includes(a.category)) throw new Error(`不正な記事定義: ${a.slug || "(no slug)"}`);
  if (a.category === "story" && !(a.sources && a.sources.length)) throw new Error(`story記事 ${a.slug} は sources[] 必須です`);
  if (seen.has(a.slug)) { skipped++; continue; }
  seen.add(a.slug);
  const [y, m, d] = a.publishedAt || [2026, 1, 1];
  const iso = new Date(Date.UTC(y, m - 1, d, 9, 0, 0)).toISOString();
  existing.push({
    id: "art_" + a.slug.replace(/-/g, "_"), slug: a.slug, category: a.category,
    authorName: a.authorName || "CAREERPORT編集部",
    ...(a.supervisorName ? { supervisorName: a.supervisorName } : {}),
    status: "draft",                       // ← 自動公開しない。人間確認後に published へ
    publishedAt: iso, updatedAt: iso,
    ...(a.sources ? { sources: a.sources } : {}),
    translations: { ja: { title: a.ja.title, metaDesc: a.ja.metaDesc || "", body: a.ja.body } },
  });
  added++;
}
mkdirSync(join(ROOT, "tools", "data"), { recursive: true });
writeFileSync(OUT, JSON.stringify(existing, null, 1), "utf-8");
console.log(`OK: added=${added} skipped(dup)=${skipped} total=${existing.length} -> articles-extra.json`);
console.log("次: 内容確認 → status を published に変更 → node tools/seed.mjs → ?v= バンプ → node build.mjs");
