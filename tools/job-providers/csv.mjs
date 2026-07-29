// プロバイダー: CSV（提携企業・代理店から直接提供される求人）
// 使い方: node tools/import-jobs.mjs csv <path.csv> [providerId]
// テンプレート: tools/data/jobs-template.csv
//
// 想定用途: 企業の直接掲載、スクール・代理店からの提供、社内での手動登録。
// 提供元との掲載許諾（掲載範囲・期間・更新方法）を書面で得てから使うこと。
import { readFileSync } from "fs";

export const id = "csv";
export const label = "CSV直接提供";

export const COLUMNS = [
  "externalId", "title", "description", "requirements", "companyName",
  "employmentType", "contractPeriod", "trialPeriod",
  "prefSlug", "city", "workplaceNote",
  "workingHours", "breakTime", "overtime", "holidays",
  "salaryMin", "salaryMax", "salaryUnit", "salaryNote",
  "insurance", "smokingPolicy", "occupationSlug", "remote", "features",
  "applyUrl", "sourceName", "sourceUrl", "postedAt", "expiresAt",
];

/** ダブルクォート対応の最小CSVパーサ（フィールド内の , と改行を扱う） */
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  const s = text.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQ) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export async function fetchJobs({ path, providerId = id } = {}) {
  if (!path) throw new Error("csv プロバイダーには --path <file.csv> が必要です");
  const rows = parseCsv(readFileSync(path, "utf-8"));
  const header = rows[0].map((h) => h.trim());
  const missing = COLUMNS.filter((c) => !header.includes(c));
  if (missing.length) throw new Error("CSVに不足している列: " + missing.join(", ") + "\n（tools/data/jobs-template.csv を使用してください）");
  return rows.slice(1).map((r) => {
    const o = {};
    header.forEach((h, i) => { o[h] = (r[i] ?? "").trim(); });
    return {
      ...o,
      providerId,
      salaryMin: o.salaryMin === "" ? null : Number(o.salaryMin),
      salaryMax: o.salaryMax === "" ? null : Number(o.salaryMax),
      remote: /^(1|true|yes|可)$/i.test(o.remote),
      features: o.features ? o.features.split("|").filter(Boolean) : [],
      insurance: o.insurance ? o.insurance.split("|").filter(Boolean).join("・") : "",
    };
  });
}
