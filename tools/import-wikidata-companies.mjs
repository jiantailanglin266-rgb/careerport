// Wikidata → 企業カタログ（catalog tier, cat:1）取得
// 実行: node tools/import-wikidata-companies.mjs
// 対象: 東京証券取引所(Q217475)上場 かつ 従業員数(P1128)が登録されている企業
//       = 客観的な数値軸（従業員数）を持つ実在企業のみ。判断を要する情報は取得しない。
// 出力: tools/data/companies.json（seed.mjs が存在すれば data.js へマージする）
// 個別静的ページは生成しない（build.mjs は companies を個別ページ化しない）。
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
const HERE = dirname(fileURLToPath(import.meta.url));
const CAP = 300; // 従業員数の多い順に上位のみ（薄カタログの氾濫を避ける）

const QUERY = `
SELECT ?c ?jaLabel ?enLabel ?emp ?inception WHERE {
  ?c wdt:P414 wd:Q217475 ; wdt:P1128 ?emp ; wdt:P17 wd:Q17 .
  OPTIONAL { ?c rdfs:label ?jaLabel FILTER(LANG(?jaLabel)="ja") }
  OPTIONAL { ?c rdfs:label ?enLabel FILTER(LANG(?enLabel)="en") }
  OPTIONAL { ?c wdt:P571 ?inception }
} LIMIT 2000`;

async function fetchSparql(query, attempt = 1) {
  const res = await fetch("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(query), {
    headers: { "User-Agent": "CAREERPORT-import/1.0 (contact: jiantailanglin266@gmail.com)", Accept: "application/sparql-results+json" },
  });
  if (res.status === 429 && attempt <= 3) {
    const wait = attempt * 15000;
    console.log(`429 rate-limited, retrying in ${wait / 1000}s...`);
    await new Promise((r) => setTimeout(r, wait));
    return fetchSparql(query, attempt + 1);
  }
  if (!res.ok) throw new Error("SPARQL " + res.status);
  return res.json();
}

const slugify = (s) =>
  String(s).normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const json = await fetchSparql(QUERY);
const rows = json.results.bindings;
console.log(`fetched ${rows.length} rows`);

const byQid = new Map();
for (const r of rows) {
  const qid = r.c.value.split("/").pop();
  const ja = r.jaLabel?.value || "";
  const en = r.enLabel?.value || "";
  if (!ja && !en) continue;
  const emp = Math.round(Number(r.emp.value));
  if (!Number.isFinite(emp) || emp <= 0 || emp > 3000000) continue; // 異常値は捨てる
  const founded = r.inception ? Number(r.inception.value.slice(0, 4)) : null;
  const prev = byQid.get(qid);
  // 同一QIDが複数行（従業員数の複数時点）→ 最大値を採用
  if (!prev || emp > prev.emp) byQid.set(qid, { qid, ja, en, emp, founded: founded && founded > 1500 ? founded : null });
}

let list = [...byQid.values()].sort((a, b) => b.emp - a.emp).slice(0, CAP);

// 名前の重複（持株会社と事業会社等で同名）→ 先勝ち
const seenName = new Set();
list = list.filter((c) => {
  const key = (c.ja || c.en).replace(/\s|（.*?）|\(.*?\)/g, "");
  if (seenName.has(key)) return false;
  seenName.add(key);
  return true;
});

// slug 衝突は QID を付与
const seenSlug = new Set();
const today = new Date().toISOString().slice(0, 10);
const out = list.map((c) => {
  let slug = slugify(c.en || c.qid) || c.qid.toLowerCase();
  if (seenSlug.has(slug)) slug = slug + "-" + c.qid.toLowerCase();
  seenSlug.add(slug);
  return {
    id: "co_" + c.qid.toLowerCase(),
    slug,
    wikidataId: c.qid,
    employees: c.emp,
    founded: c.founded,
    listed: true,
    industryId: null, prefId: null, // 判断を要するマッピングは空のまま（捏造しない）
    sourceName: "Wikidata", sourceUrl: "https://www.wikidata.org/wiki/" + c.qid,
    updatedAt: today,
    status: "published", cat: 1,
    translations: { ja: { name: c.ja || c.en, summary: `東京証券取引所上場企業。従業員数 ${c.emp.toLocaleString()}人（Wikidata登録値・時点は出典参照）。基本情報のみの掲載です。` } },
  };
});

mkdirSync(join(HERE, "data"), { recursive: true });
writeFileSync(join(HERE, "data", "companies.json"), JSON.stringify(out, null, 1), "utf-8");
console.log(`OK: ${out.length} companies -> tools/data/companies.json（seed.mjs 実行で data.js に反映）`);
