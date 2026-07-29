// プロバイダー: schema.org JobPosting フィード（JSON / JSON-LD 配列）
// 使い方: node tools/import-jobs.mjs jobposting <feedUrl|path.json> [providerId]
//
// 想定用途: 求人サイト・ATS（採用管理システム）が提供する標準フィードの取り込み。
//   多くのATS（Workday, Greenhouse, HERP, HRMOS 等）が JobPosting 形式のフィードを出せる。
// 前提: フィード提供元との利用許諾（再掲載の可否・範囲）を得ていること。
//   許諾のないフィードのスクレイピング／転載は行わない。
import { readFileSync } from "fs";

export const id = "jobposting";
export const label = "JobPostingフィード";

const PREF_BY_NAME = null; // prefSlug への変換は import-jobs 側の共通マッピングで行う

const txt = (v) => (typeof v === "string" ? v : v == null ? "" : String(v));
const stripTags = (s) => txt(s).replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/\s+\n/g, "\n").trim();

const TYPE_MAP = {
  FULL_TIME: "fulltime", PART_TIME: "parttime", CONTRACTOR: "contract",
  TEMPORARY: "temporary", INTERN: "parttime", OTHER: "contract",
};
const UNIT_MAP = { YEAR: "year", MONTH: "month", DAY: "day", HOUR: "hour" };

export async function fetchJobs({ path, url, providerId = id } = {}) {
  const src = path ? readFileSync(path, "utf-8") : await (await fetch(url, {
    headers: { "User-Agent": "CAREERPORT-jobimport/1.0 (contact: jiantailanglin266@gmail.com)" },
  })).text();
  let data = JSON.parse(src);
  // { "@graph": [...] } / { items: [...] } / [...] のいずれにも対応
  if (!Array.isArray(data)) data = data["@graph"] || data.items || data.jobs || [];
  return data.filter((d) => !d["@type"] || String(d["@type"]).includes("JobPosting")).map((d) => {
    const org = d.hiringOrganization || {};
    const loc = (Array.isArray(d.jobLocation) ? d.jobLocation[0] : d.jobLocation) || {};
    const addr = loc.address || {};
    const bs = d.baseSalary || {};
    const val = bs.value || {};
    return {
      providerId,
      externalId: txt(d.identifier?.value || d.identifier || d["@id"] || d.url),
      title: txt(d.title),
      description: stripTags(d.description),
      requirements: stripTags(d.qualifications || d.experienceRequirements),
      companyName: txt(org.name),
      employmentType: TYPE_MAP[String(Array.isArray(d.employmentType) ? d.employmentType[0] : d.employmentType).toUpperCase()] || "",
      contractPeriod: "", trialPeriod: "",       // JobPosting標準に無いため、フィード側の拡張 or CSV補完が必要
      prefRegionName: txt(addr.addressRegion),   // import-jobs 側で prefSlug に解決
      city: txt(addr.addressLocality),
      workplaceNote: txt(addr.streetAddress),
      workingHours: txt(d.workHours),
      breakTime: "", overtime: "",
      holidays: "",
      salaryMin: val.minValue != null ? Number(val.minValue) : (val.value != null ? Number(val.value) : null),
      salaryMax: val.maxValue != null ? Number(val.maxValue) : null,
      salaryUnit: UNIT_MAP[String(val.unitText).toUpperCase()] || "",
      salaryNote: txt(bs.currency && bs.currency !== "JPY" ? `通貨: ${bs.currency}` : ""),
      insurance: "", smokingPolicy: "",
      occupationSlug: "",
      remote: /true|yes/i.test(txt(d.jobLocationType)) || String(d.jobLocationType).includes("TELECOMMUTE"),
      features: [],
      applyUrl: txt(d.url || d.applicationContact?.url),
      sourceName: txt(d.publisher?.name || org.name),
      sourceUrl: txt(d.url),
      postedAt: txt(d.datePosted),
      expiresAt: txt(d.validThrough),
    };
  });
}

/* 注意:
   JobPosting 標準には「契約期間」「試用期間」「加入保険」「受動喫煙防止措置」「休日」に
   対応するプロパティが無い。日本の募集要項として必要なこれらの項目は、
   フィード提供元に拡張フィールドで出してもらうか、CSVで補完する必要がある。
   補完がない求人は _core.mjs の検証で弾かれる（＝不完全な求人情報は掲載しない）。 */
