// 実求人の取り込み CLI
//
// 使い方:
//   node tools/import-jobs.mjs csv --path tools/data/jobs-sample.csv
//   node tools/import-jobs.mjs jobposting --url https://example.com/jobs.json --provider acme
//   node tools/import-jobs.mjs --list                 … プロバイダー一覧
//   node tools/import-jobs.mjs --prune                … 期限切れを削除するだけ
//
// 出力: tools/data/jobs.json（正規形の配列）+ tools/data/jobs-log.json（取込ログ）
//   → node tools/seed.mjs が jobs.js を書き出し、SPA/SSG が実求人として扱う
//
// 取り込みの原則（tools/job-providers/_core.mjs に実装）:
//   - 法定明示項目（業務内容・契約期間・試用期間・就業場所・就業時間・休日・賃金・
//     加入保険・受動喫煙防止措置・募集主体）が揃っている求人だけを取り込む
//   - 差別的な募集条件を含む求人は取り込まない
//   - 掲載期限切れ・出典URLなしは取り込まない
//   - 既存の取り込み済み求人は、同じ providerId の分だけ入れ替える（他社分は保持）
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { normalizeAll } from "./job-providers/_core.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, "tools", "data", "jobs.json");
const LOG = join(ROOT, "tools", "data", "jobs-log.json");

const PROVIDERS = {
  csv: "./job-providers/csv.mjs",
  jobposting: "./job-providers/jobposting-feed.mjs",
  hellowork: "./job-providers/hellowork-online.mjs",
};

/* ---- 引数 ---- */
const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf("--" + n); return i >= 0 ? argv[i + 1] : undefined; };
const has = (n) => argv.includes("--" + n);
const providerKey = argv.find((a) => !a.startsWith("--"));

if (has("list") || (!providerKey && !has("prune"))) {
  console.log("プロバイダー:");
  for (const [k, p] of Object.entries(PROVIDERS)) {
    const m = await import(p);
    console.log(`  ${k.padEnd(12)} ${m.label}${m.connected === false ? "  ※未接続" : ""}`);
  }
  console.log("\n例: node tools/import-jobs.mjs csv --path tools/data/jobs-sample.csv");
  process.exit(0);
}

/* ---- 参照データ（都道府県・職種の照合に使う） ---- */
const DATA = JSON.parse(readFileSync(join(ROOT, "data.js"), "utf-8").match(/^var DATA=(.*);$/m)[1]);
const PREF_SLUGS = new Set(DATA.prefectures.map((p) => p.slug));
const PREF_BY_NAME = Object.fromEntries(DATA.prefectures.map((p) => [p.names.ja, p.slug]));
const OCC_SLUGS = new Set(DATA.occupations.map((o) => o.slug));

const now = new Date();
const existing = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf-8")) : [];

/* ---- 期限切れの削除だけ ---- */
if (has("prune")) {
  const kept = existing.filter((j) => new Date(j.expiresAt) >= now);
  writeFileSync(OUT, JSON.stringify(kept, null, 1), "utf-8");
  console.log(`prune: ${existing.length} → ${kept.length}（期限切れ ${existing.length - kept.length} 件を削除）`);
  process.exit(0);
}

/* ---- 取得 ---- */
const modPath = PROVIDERS[providerKey];
if (!modPath) { console.error("不明なプロバイダー: " + providerKey); process.exit(1); }
const provider = await import(modPath);
const providerId = flag("provider") || provider.id;

let raw;
try {
  raw = await provider.fetchJobs({ path: flag("path"), url: flag("url"), providerId });
} catch (e) {
  console.error("取得に失敗しました:\n" + e.message);
  process.exit(1);
}
console.log(`取得: ${raw.length} 件（${provider.label} / providerId=${providerId}）`);

/* ---- 都道府県名 → slug、職種 slug の妥当性チェック ---- */
for (const j of raw) {
  if (!j.prefSlug && j.prefRegionName) j.prefSlug = PREF_BY_NAME[j.prefRegionName] || "";
  if (j.prefSlug && !PREF_SLUGS.has(j.prefSlug)) j.prefSlug = "";      // 不明な地域は空にして検証で弾く
  if (j.occupationSlug && !OCC_SLUGS.has(j.occupationSlug)) j.occupationSlug = "";
}

/* ---- 正規化・検証 ---- */
const { jobs, rejected } = normalizeAll(raw, { providerId, now });

/* ---- 既存とマージ（同一 providerId 分を入れ替え、他社分は保持） ---- */
const others = existing.filter((j) => j.providerId !== providerId);
const merged = others.concat(jobs).filter((j) => new Date(j.expiresAt) >= now);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(merged, null, 1), "utf-8");

/* ---- 取込ログ（運用記録・監査用） ---- */
const log = existsSync(LOG) ? JSON.parse(readFileSync(LOG, "utf-8")) : [];
log.unshift({
  at: now.toISOString(), providerId, provider: provider.label,
  fetched: raw.length, accepted: jobs.length, rejected: rejected.length,
  totalAfter: merged.length,
  rejectReasons: rejected.slice(0, 50),
});
writeFileSync(LOG, JSON.stringify(log.slice(0, 200), null, 1), "utf-8");

console.log(`採用: ${jobs.length} / 破棄: ${rejected.length}`);
if (rejected.length) {
  const counts = {};
  rejected.forEach((r) => r.errs.forEach((e) => { counts[e] = (counts[e] || 0) + 1; }));
  console.log("破棄理由:");
  Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([e, n]) => console.log(`  ${String(n).padStart(4)} 件  ${e}`));
}
console.log(`\n掲載中の実求人: ${merged.length} 件 → tools/data/jobs.json`);
console.log("次: node tools/seed.mjs → index.html の data.js?v= をバンプ → node build.mjs");
