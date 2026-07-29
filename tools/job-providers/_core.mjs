// 求人データの正規化スキーマ・検証・ユーティリティ（全プロバイダー共通）
//
// 設計方針:
//  1. どのソースから来た求人も、この正規形（NormalizedJob）に変換してから取り込む。
//     プロバイダーを増やすときは adapter を1本足すだけで、以降の処理は共通。
//  2. 職業安定法・労働基準法で明示が求められる項目を「必須」として検証し、
//     欠けている求人は取り込まない（表示できない項目を空欄で出すより、載せない）。
//  3. 差別的な募集条件（性別・年齢の限定等）を検出したら取り込まない。
//  4. 掲載期限切れ・出典URLなしは取り込まない。
//  5. 当サイトは職業紹介を行わない。応募は必ず募集主体または掲載元サイトへ外部遷移させる。

/* ========== 正規形 ==========
{
  providerId, externalId,           // プロバイダー内での一意キー（重複判定に使う）
  slug,                             // URLセグメント（import時に採番）
  title, description,               // 業務内容（必須）
  companyName,                      // 募集主体の名称（必須）
  employmentType,                   // fulltime|contract|dispatch|parttime|temporary（必須）
  contractPeriod, trialPeriod,      // 契約期間・試用期間（必須。「定めなし」も明示）
  prefSlug, city, workplaceNote,    // 就業場所（必須）
  workingHours, breakTime, overtime,// 就業時間・休憩・時間外（必須）
  holidays,                         // 休日（必須）
  salaryMin, salaryMax, salaryUnit, // 賃金（必須。unit: year|month|hour|day）
  salaryNote,
  insurance,                        // 加入保険（必須）
  smokingPolicy,                    // 受動喫煙防止措置（必須）
  occupationSlug,                   // 当サイト職種への対応（任意・未対応可）
  remote, features,                 // リモート可・特徴タグ
  applyUrl,                         // 応募先（外部）（必須）
  sourceName, sourceUrl,            // 掲載元の名称・求人ページURL（必須）
  postedAt, expiresAt,              // 掲載開始・掲載期限（必須）
  fetchedAt                         // 取得日時（import時に付与）
}
*/

export const EMPLOYMENT_TYPES = ["fulltime", "contract", "dispatch", "parttime", "temporary"];
export const SALARY_UNITS = ["year", "month", "day", "hour"];

// 職業安定法5条の3（労働条件等の明示）等をふまえた必須項目
export const REQUIRED_FIELDS = [
  "providerId", "externalId", "title", "description", "companyName",
  "employmentType", "contractPeriod", "trialPeriod",
  "prefSlug", "workingHours", "holidays",
  "salaryMin", "salaryUnit", "insurance", "smokingPolicy",
  "applyUrl", "sourceName", "sourceUrl", "postedAt", "expiresAt",
];

// 取り込みを拒否する表現（男女雇用機会均等法・雇用対策法の趣旨に反する募集条件）
const DISCRIMINATORY = [
  /(男性|女性|男子|女子)\s*(のみ|限定|歓迎|向け)/,
  /(男|女)性活躍中?(?!の職場)/,      // 「女性活躍中」等の性別限定を示唆する表記
  /\d{2}\s*歳\s*(まで|以下|未満)(?!の方も歓迎)/,
  /(若手|シニア)\s*(のみ|限定)/,
  /(未婚|既婚|子供のいない)/,
  /(日本人|外国人)\s*(のみ|限定)/,
];

export class JobValidationError extends Error {
  constructor(reason, job) {
    super(reason);
    this.reason = reason;
    this.jobKey = job ? `${job.providerId}:${job.externalId}` : "(unknown)";
  }
}

const isBlank = (v) => v == null || String(v).trim() === "";

/** 正規形1件を検証する。問題があれば理由の配列を返す（空配列＝合格） */
export function validateJob(job, { now = new Date() } = {}) {
  const errs = [];
  for (const f of REQUIRED_FIELDS) {
    if (isBlank(job[f])) errs.push(`必須項目 ${f} が空`);
  }
  if (job.employmentType && !EMPLOYMENT_TYPES.includes(job.employmentType)) {
    errs.push(`employmentType が不正: ${job.employmentType}`);
  }
  if (job.salaryUnit && !SALARY_UNITS.includes(job.salaryUnit)) {
    errs.push(`salaryUnit が不正: ${job.salaryUnit}`);
  }
  if (job.salaryMin != null && job.salaryMax != null && Number(job.salaryMin) > Number(job.salaryMax)) {
    errs.push("salaryMin > salaryMax");
  }
  for (const f of ["applyUrl", "sourceUrl"]) {
    if (!isBlank(job[f]) && !/^https:\/\//.test(job[f])) errs.push(`${f} は https:// で始まる必要があります`);
  }
  if (!isBlank(job.expiresAt)) {
    const exp = new Date(job.expiresAt);
    if (Number.isNaN(exp.getTime())) errs.push("expiresAt が日付として不正");
    else if (exp < now) errs.push("掲載期限切れ");
  }
  const text = [job.title, job.description, job.requirements, job.features].filter(Boolean).join(" ");
  for (const re of DISCRIMINATORY) {
    if (re.test(text)) { errs.push(`差別的な募集条件の可能性: ${re}`); break; }
  }
  return errs;
}

/** 重複判定キー（同一求人が別IDで複数回来るケースを吸収する） */
export function dedupeKey(job) {
  const norm = (s) => String(s || "").replace(/[\s　]+/g, "").toLowerCase();
  return [norm(job.companyName), norm(job.title), norm(job.prefSlug), norm(job.employmentType)].join("|");
}

/** 年収（万円）への換算。表示・絞り込み用の目安であり、原値は salary* に保持する */
export function annualSalaryMan(job) {
  const v = Number(job.salaryMin);
  if (!Number.isFinite(v) || v <= 0) return null;
  switch (job.salaryUnit) {
    case "year":  return Math.round(v / 10000);
    case "month": return Math.round((v * 12) / 10000);
    case "day":   return Math.round((v * 20 * 12) / 10000);
    case "hour":  return Math.round((v * 8 * 20 * 12) / 10000);
    default:      return null;
  }
}

export function slugify(job, seq) {
  const base = String(job.externalId || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24).toLowerCase();
  return `${job.providerId}-${base || String(seq).padStart(6, "0")}`;
}

/** プロバイダーの返した生データ配列 → 検証済み正規形配列 + 破棄理由レポート */
export function normalizeAll(rawJobs, { providerId, now = new Date() } = {}) {
  const ok = [];
  const rejected = [];
  const seen = new Set();
  rawJobs.forEach((raw, i) => {
    const job = { ...raw, providerId: raw.providerId || providerId, fetchedAt: now.toISOString() };
    const errs = validateJob(job, { now });
    if (errs.length) { rejected.push({ key: `${job.providerId}:${job.externalId ?? i}`, errs }); return; }
    const k = dedupeKey(job);
    if (seen.has(k)) { rejected.push({ key: `${job.providerId}:${job.externalId}`, errs: ["重複（同一企業・職種・勤務地）"] }); return; }
    seen.add(k);
    job.slug = job.slug || slugify(job, i);
    job.annualSalaryMan = annualSalaryMan(job);
    ok.push(job);
  });
  return { jobs: ok, rejected };
}
