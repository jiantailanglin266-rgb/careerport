// 年収データ CSVインポータ — 公的統計（e-Stat 賃金構造基本統計調査 等）を取り込む
// 実行: node tools/import-salary-csv.mjs tools/data/salary.csv
// 出力: tools/data/salary.json（seed.mjs が data.js へマージ）
//
// CSV列（1行目ヘッダー必須。テンプレート: tools/data/salary-template.csv）:
//   occupationSlug,industrySlug,prefSlug,ageGroup,genderGroup,averageSalary,medianSalary,
//   salaryMin,salaryMax,sampleCount,period,sourceName,sourceUrl,sourceDate
// 規約（ファクトポリシー）:
//   - sourceName / sourceUrl / sourceDate のない行は取り込まない（出典必須）
//   - 金額列は万円単位の数値。不明は空欄（null として保存。0や推定値で埋めない）
//   - occupationSlug / industrySlug / prefSlug は data.js 側の slug と一致必須（空欄可=全体値）
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const csvPath = process.argv[2];
if (!csvPath) { console.error("usage: node tools/import-salary-csv.mjs <path/to.csv>"); process.exit(1); }

// seed 側の slug 辞書（data.js からではなく seed の定義と同じソースを読む必要があるため data.js を参照）
const dataSrc = readFileSync(join(ROOT, "data.js"), "utf-8");
const DATA = JSON.parse(dataSrc.match(/^var DATA=(.*);$/m)[1]);
const occBy = Object.fromEntries(DATA.occupations.map((o) => [o.slug, o.id]));
const indBy = Object.fromEntries(DATA.industries.map((x) => [x.slug, x.id]));
const prefBy = Object.fromEntries(DATA.prefectures.map((p) => [p.slug, p.id]));

const HEADER = "occupationSlug,industrySlug,prefSlug,ageGroup,genderGroup,averageSalary,medianSalary,salaryMin,salaryMax,sampleCount,period,sourceName,sourceUrl,sourceDate";
const lines = readFileSync(csvPath, "utf-8").replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
if (lines[0].trim() !== HEADER) throw new Error("ヘッダー行が想定と異なります。テンプレート(salary-template.csv)を使用してください。");

const num = (s) => (s === "" || s == null ? null : Number(s));
const today = new Date().toISOString().slice(0, 10);
const out = [];
const errors = [];
lines.slice(1).forEach((line, i) => {
  const c = line.split(",").map((x) => x.trim());
  if (c.length !== 14) { errors.push(`row ${i + 2}: 列数が14ではありません（フィールド内のカンマは使用不可）`); return; }
  const [occ, ind, pref, ageGroup, genderGroup, avg, med, min, max, n, period, sourceName, sourceUrl, sourceDate] = c;
  if (!sourceName || !sourceUrl || !sourceDate) { errors.push(`row ${i + 2}: 出典（sourceName/sourceUrl/sourceDate）は必須です`); return; }
  if (occ && !occBy[occ]) { errors.push(`row ${i + 2}: 不明な occupationSlug "${occ}"`); return; }
  if (ind && !indBy[ind]) { errors.push(`row ${i + 2}: 不明な industrySlug "${ind}"`); return; }
  if (pref && !prefBy[pref]) { errors.push(`row ${i + 2}: 不明な prefSlug "${pref}"`); return; }
  for (const v of [avg, med, min, max]) {
    if (v !== "" && (!Number.isFinite(Number(v)) || Number(v) < 50 || Number(v) > 10000)) { errors.push(`row ${i + 2}: 金額 "${v}" が不正です（万円単位・50〜10000の範囲）`); return; }
  }
  out.push({
    occupationId: occ ? occBy[occ] : null, industryId: ind ? indBy[ind] : null, prefId: pref ? prefBy[pref] : null,
    ageGroup: ageGroup || "all", genderGroup: genderGroup || "all",
    averageSalary: num(avg), medianSalary: num(med), salaryMin: num(min), salaryMax: num(max),
    sampleCount: num(n), period: period || "",
    sourceName, sourceUrl, sourceDate, updatedAt: today,
  });
});

if (errors.length) { console.error("取り込み中止:\n" + errors.join("\n")); process.exit(1); }
mkdirSync(join(ROOT, "tools", "data"), { recursive: true });
writeFileSync(join(ROOT, "tools", "data", "salary.json"), JSON.stringify(out, null, 1), "utf-8");
console.log(`OK: ${out.length} rows -> tools/data/salary.json（node tools/seed.mjs で data.js に反映 + ?v= バンプ）`);
