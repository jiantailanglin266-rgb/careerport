// CAREERPORT SSG ビルド — index.html(SPA) + data.js から静的ページ群を生成する
// 実行: node build.mjs   （index.html / data.js 変更のたび、デプロイ前に必ず実行）
// 方針:
//  - デモ求人・デモサービスの個別ページは生成しない（誤認防止・薄ページ回避。SPA+404で表示）
//  - JobPosting 構造化データは実求人（正規ソース・期限内）のみ。現状デモのみ＝一切出力しない
//  - 統計値のプリレンダーは「データ準備中」の文言のまま（架空数値を出さない）
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SITE = "https://jiantailanglin266-rgb.github.io/careerport"; // TODO: 公開先確定後に変更（README参照）
const src = readFileSync(join(ROOT, "index.html"), "utf-8");
const dataSrc = readFileSync(join(ROOT, "data.js"), "utf-8");
const m0 = dataSrc.match(/^var DATA=(.*);$/m);
if (!m0) throw new Error("DATA not found in data.js");
const DATA = JSON.parse(m0[1]);

const L = "ja";
const tr = (o) => (o.translations ? o.translations.ja : {});
const nm = (o) => (o.names ? o.names.ja : "");
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const S = " | CAREERPORT";

/* ---- 職種FAQ（SPAの occFaq と同一ロジック） ---- */
const salaryRowFor = (slug) => (DATA.salaryData || []).find((r) => (r.occupationSlugs || []).includes(slug));
function occFaq(o) {
  const t = tr(o);
  const sr = salaryRowFor(o.slug);
  return [
    [`${t.name}は未経験でも転職できますか？`, t.inexperienced || "職種ページの解説をご覧ください。"],
    [`${t.name}に必要なスキルは？`, t.skills || "準備中です。"],
    [`${t.name}のキャリアパスは？`, t.careerPath || "準備中です。"],
    [`${t.name}の平均年収は？`, sr
      ? `賃金構造基本統計調査（${sr.period}）の統計区分「${sr.label}」では、きまって支給する現金給与額×12＋年間賞与で算出した平均年収は約${sr.averageSalary}万円です（平均年齢${sr.averageAge}歳・一般労働者）。個人差が大きいため参考値としてご覧ください。`
      : "この職種に対応する統計区分のデータは現在準備中です。年収データベースの方針をご覧ください。"],
  ];
}

/* ---- ページ定義 ---- */
const pages = [];
const push = (path, title, desc, opts = {}) => pages.push({ path, title, desc, ...opts });

const STATIC_PAGES = {
  home: ["/", "CAREERPORT（キャリアポート） — キャリアの出港地。迷いを、進路に変える。",
    "求人・転職エージェント・スカウト・年収・転職ノウハウを横断して比較できる転職情報ポータル。AIキャリア診断・書類添削を無料で提供。あなたの次の進路を見つける出港地。"],
  jobs: ["/jobs/", "求人を探す — 職種・勤務地から仕事の情報・平均年収・探せる場所を調べる" + S,
    "職種・勤務地・雇用形態から、その仕事の内容・平均年収（公的統計）・未経験の入りやすさと、実際に求人を探せる場所をまとめて案内します。当サイトは求人の掲載・仲介を行っていません。"],
  services: ["/services/", "転職サービス比較 — エージェント・スカウト・求人サイトの違いと選び方" + S,
    "転職エージェント・スカウト型・求人検索サイト・派遣。タイプ別の仕組みの違いと選び方を整理し、目的別に比較できます。"],
  careers: ["/career/", "年代・状況から探す — 20代/30代/40代/女性/未経験/ハイクラス" + S,
    "20代・30代・40代・50代、女性、第二新卒、未経験、ハイクラス、管理職など、年代・状況別の転職の進め方とサービスの選び方。"],
  occupations: ["/occupation/", `職種から探す — 全${DATA.occupations.length}職種の仕事内容・スキル・キャリアパス・未経験転職` + S,
    `営業・事務・経理・エンジニア・介護・看護など全${DATA.occupations.length}職種の仕事内容、必要なスキル、キャリアパス、未経験転職の目安を職種別に解説。`],
  industries: ["/industry/", "業界から探す — 16業界の概要と転職ガイド" + S,
    "IT・Web・金融・不動産・建設・製造・医療・介護など16業界の概要と代表的な職種、転職の入口を整理しています。"],
  areas: ["/area/", "地域から探す — 47都道府県の転職ガイド" + S,
    "47都道府県別の転職情報の入口。地域の求人傾向・統計データは公的データ接続後に出典つきで掲載します。"],
  salary: (DATA.salaryData || []).length
    ? ["/salary/", `職種・業界・都道府県別の平均年収一覧【${DATA.salaryData[0].period}】賃金構造基本統計調査` + S,
       `賃金構造基本統計調査（${DATA.salaryData[0].period}）に基づく職種${DATA.salaryData.filter(r=>r.group==="occupation").length}区分・産業${DATA.salaryData.filter(r=>r.group==="industry").length}区分・47都道府県の平均年収一覧。きまって支給する現金給与額×12＋年間賞与で算出した参考値を出典つきで掲載。`]
    : ["/salary/", "年収データベース — 職種別・業界別・地域別・年代別（準備中）" + S,
       "職種別・業界別・地域別・年代別の年収統計を出典と時点を明示して掲載するデータベース。現在は公的統計との接続準備中です。"],
  articles: ["/guide/", "転職ノウハウ — 退職・書類・面接・年収交渉の実用ガイド" + S,
    "転職活動の始め方から退職、履歴書・職務経歴書、面接、年収交渉、失業保険まで。各段階の疑問に答える実用ガイド。"],
  videos: (DATA.videos || []).length
    ? ["/videos/", `動画で学ぶ 転職・求人【公的機関の公式動画${DATA.videos.length}本】` + S,
       `厚生労働省・各都道府県労働局・ハローワーク・自治体の公式YouTubeチャンネルが公開する動画${DATA.videos.length}本を、雇用保険・職業訓練・面接・求人票の見方などのテーマ別にまとめました。`]
    : ["/videos/", "動画で学ぶ 転職・求人" + S, "公的機関の公式動画を準備中です。"],
  stories: ["/stories/", "体験談・ストーリー — 転職経験と日本の仕事の歴史" + S,
    "転職経験者のインタビュー（本人同意の取材に基づく方針・現在サンプル表示）と、日本の働き方の歴史をたどる読み物。"],
  learning: ["/learning/", "リスキリング・スクール比較 — 学び直しから転職へ" + S,
    "プログラミング・資格・英語などのスクールと講座の比較。目指す仕事から逆算する学び方も解説します。"],
  tools: ["/tools/", "転職の無料ツール14種 — 手取り計算・失業給付・年収チェック・書類添削" + S,
    "手取り計算、失業給付シミュレーター、年収チェック、有給休暇の日数計算、残業代計算、退職スケジュール逆算、書類添削、面接想定質問、AIキャリア診断。すべて無料・登録不要で、入力内容は端末の外に送信されません。"],
  "tool-diagnosis": ["/tools/career-diagnosis/", "AIキャリア診断 — 3分でキャリアの方向性を整理（無料）" + S,
    "7つの質問と強みの選択からキャリアの方向性・相性のよい職種の候補を整理。無料・登録不要・入力内容は端末の外に送信されません。"],
  "ai-consultation": ["/ai-consultation/", "AIチャット相談 — 転職の疑問にその場で回答" + S,
    "退職・書類・面接・年収・サービス選びなど転職活動の疑問にルールベースで回答するチャット相談。無料・登録不要。"],
  mypage: ["/mypage/", "マイページ — お気に入り・診断履歴（端末内保存）" + S,
    "お気に入りの求人・サービス、診断履歴、閲覧履歴をブラウザ内にのみ保存するマイページ。サーバー登録は不要です。"],
  about: ["/about/", "CAREERPORTについて" + S, "CAREERPORTの目的、やること・やらないこと、情報の方針について。"],
  company: ["/company/", "運営会社" + S, "CAREERPORTの運営者情報（正式公開前に確定・掲載します）。"],
  "editorial-policy": ["/editorial-policy/", "編集方針" + S, "読者第一・出典主義・断定しない・捏造しない。CAREERPORTのコンテンツ制作の原則とAI利用方針。"],
  "expert-supervision": ["/expert-supervision/", "監修方針" + S, "YMYL領域としての監修体制の方針。架空の専門家を監修者として表示することはありません。"],
  "data-policy": ["/data-policy/", "データポリシー" + S, "統計データの出典・時点の明示、Wikipedia/Wikimedia Commonsの帰属表示、求人情報の取り扱い方針。"],
  "advertising-policy": ["/advertising-policy/", "広告掲載方針" + S, "PR表記・rel=sponsored・ランキングの根拠の明示。報酬による比較結果の操作は行いません。"],
  privacy: ["/privacy/", "プライバシーポリシー" + S, "個人情報をサーバーで収集しない設計と、ツール入力内容のブラウザ内処理について。"],
  terms: ["/terms/", "利用規約" + S, "CAREERPORTの利用規約。情報メディアとしての位置づけと免責について。"],
  disclaimer: ["/disclaimer/", "免責事項" + S, "転職の成功・内定・年収上昇を保証しないこと、AIツールの結果が参考情報であることについて。"],
  contact: ["/contact/", "お問い合わせ" + S, "お問い合わせ窓口（外部フォームサービス接続後に設置します）。"],
  faq: ["/faq/", "よくある質問" + S, "CAREERPORTの利用料金、サービスの位置づけ、データの取り扱いに関するよくある質問。"],
  "correction-request": ["/correction-request/", "訂正依頼窓口" + S, "掲載内容の誤りのご指摘窓口。事実確認のうえ訂正し、重要な訂正は履歴を明示します。"],
  companies: ["/companies/", "企業情報 — 上場企業カタログ（Wikidata出典）" + S,
    (DATA.companies || []).length
      ? `東京証券取引所の上場企業のうちWikidataに従業員数が登録されている${DATA.companies.length}社の基本情報カタログ。名称・従業員数・設立年のみを出典つきで掲載。`
      : "企業データベースは出典を明示できるデータソース接続後に公開します。"],
  "sitemap-page": ["/sitemap-page/", "サイトマップ" + S, "CAREERPORTの全ページ一覧。"],
};
for (const k in STATIC_PAGES) {
  const [p, t, d] = STATIC_PAGES[k];
  push(`/${L}${p}`, t, d, { kind: k });
}
// AI書類添削 4種
const REVIEWS = {
  "resume-review": ["AI履歴書添削", "履歴書の志望動機欄などの文章を無料でセルフチェック。分量・数値化・表現をルールベースで添削します。入力は外部送信されません。"],
  "career-history-review": ["AI職務経歴書添削", "職務経歴書の構成・実績の数値化・読みやすさを無料でセルフチェック。入力は外部送信されません。"],
  "motivation-review": ["AI志望動機添削", "志望動機の3段構成（転職理由→なぜこの会社か→貢献）を無料でセルフチェック。入力は外部送信されません。"],
  "self-promotion-review": ["AI自己PR添削", "自己PRの構成（結論→根拠→活かし方）を無料でセルフチェック。入力は外部送信されません。"],
};
for (const slug in REVIEWS) push(`/${L}/tools/${slug}/`, REVIEWS[slug][0] + " — 無料・登録不要" + S, REVIEWS[slug][1], { kind: "tool-review", slug });

/* 無料ツール（計算系）7種。法定値が未投入なら計算しない旨だけの薄いページになるため、
   statutory があるときだけ「使える計算」として索引化する。 */
const ST = DATA.statutory || null;
const CALCS = {
  "salary-check": ["年収チェック", "自分の年収は平均より上か下か — 職種・業界・地域別の統計と比較（無料）",
    `厚生労働省の賃金構造基本統計調査にもとづく職種${(DATA.salaryData||[]).filter(r=>r.group==="occupation").length}区分・業界${(DATA.salaryData||[]).filter(r=>r.group==="industry").length}区分・47都道府県のデータと、自分の年収を比べられる無料ツール。出典・調査時点つき。`,
    ["比べられる統計は職種別・業界別・地域別の3種類です。",
     "統計の平均は年齢構成・企業規模・地域の影響を受けるため、個人の適正年収を示すものではありません。",
     "転職後の年収を予測・保証するものではありません。"]],
  "take-home": ["手取り計算", "年収の手取りはいくら？ — 社会保険料・所得税・住民税の内訳を計算（無料）",
    "額面の年収から健康保険・介護保険・厚生年金・雇用保険・所得税・住民税を差し引いた手取りの目安を計算します。健康保険料率は協会けんぽの都道府県別料率を使用。賞与の回数・扶養人数にも対応した無料ツール。",
    ["健康保険料率は都道府県別（協会けんぽ）、厚生年金は18.3%の労使折半で計算します。",
     "月給と賞与を分けて標準報酬月額の等級にあてはめます。",
     "生命保険料控除・住宅ローン控除などの個別の控除は含まない概算です。"]],
  "unemployment-benefit": ["失業給付シミュレーター", "失業保険はいくら・何日もらえる？ — 基本手当の試算（無料）",
    "雇用保険の基本手当（失業保険）の日額・所定給付日数・受け取り開始時期の目安を、厚生労働省が公表する計算式と所定給付日数表にもとづいて試算します。自己都合・会社都合の違い、待期7日と給付制限にも対応。",
    ["基本手当日額は厚生労働省公表の計算式（年齢区分ごとの逓減式と上限額）で計算します。",
     "所定給付日数はハローワークインターネットサービスの公表表を使用します。",
     "実際の支給額・日数はハローワークが決定します。受給を保証するものではありません。"]],
  "paid-leave": ["有給休暇 日数計算", "有給休暇は何日もらえる？ — 勤続年数・勤務日数から計算（無料）",
    "労働基準法第39条にもとづく年次有給休暇の付与日数を、入社日と週の所定労働日数・労働時間から計算します。パート・アルバイトの比例付与、年5日の取得義務、2年の時効にも対応した無料ツール。",
    ["週30時間以上または週5日以上の勤務は通常の付与日数（6か月で10日、最大20日）です。",
     "週4日以下かつ週30時間未満の場合は比例付与になります。",
     "就業規則で法定を上回る定めがある場合は会社の規定が優先されます。"]],
  "overtime": ["残業代計算", "残業代はいくら？ — 時間外・深夜・休日の割増賃金を計算（無料）",
    "労働基準法第37条の割増率（時間外25%、月60時間超50%、深夜25%、法定休日35%）にもとづいて、1か月の残業代の目安を計算します。月平均所定労働時間から1時間あたりの賃金を自動で算出。",
    ["1時間あたりの賃金は月給÷月平均所定労働時間で計算します。",
     "家族手当・通勤手当・住宅手当・賞与は除外賃金として月給に含めません。",
     "管理監督者・裁量労働制・固定残業代がある場合は計算方法が異なります。"]],
  "resignation-schedule": ["退職スケジュール逆算", "退職はいつ伝える？ — 有給消化・引き継ぎから逆算（無料）",
    "退職希望日から、退職を伝える時期・引き継ぎ開始・有給休暇の消化・最終出社日を逆算します。退職後の健康保険と年金の切り替え、失業給付の手続き、住民税の扱いなど必要な手続きの目安つき。",
    ["民法第627条では、期間の定めのない雇用は申し入れから2週間で終了します。",
     "実務上は就業規則の申し出期限（1か月前が多い）に従うのが円満です。",
     "有給消化日数は土日を除いた営業日で計算します。"]],
  "interview-questions": ["面接想定質問", "転職面接で聞かれること — 職種・状況別の想定質問と逆質問（無料）",
    "応募する職種の分野と、未経験・離職期間あり・在籍期間が短い・マネジメント経験ありなどの状況から、面接で聞かれやすい質問と答え方の着眼点、逆質問の候補を組み立てます。",
    ["職種別の質問と、状況別に聞かれやすい質問を組み合わせて提示します。",
     "答え方の着眼点は経歴を書き換えるためのものではありません。",
     "実際の質問は企業・面接官により異なり、選考の通過を保証するものではありません。"]],
};
for (const slug in CALCS) {
  const [name, title, desc, points] = CALCS[slug];
  push(`/${L}/tools/${slug}/`, title + S, desc, { kind: "tool-calc", slug, name, points });
}

// 動的: 職種 / 業界 / 地域 / 属性 / 記事 / ランキング
for (const o of DATA.occupations) {
  if (o.cat) continue;
  const t = tr(o);
  push(`/${L}/occupation/${o.slug}/`, `${t.name}の転職ガイド — 仕事内容・スキル・キャリアパス・未経験転職` + S,
    String(t.summary).slice(0, 155), { kind: "occupation", o });
}
for (const x of DATA.industries) {
  push(`/${L}/industry/${x.slug}/`, `${nm(x)}業界の転職ガイド — 概要・職種・転職の入口` + S,
    String(x.summaries.ja).slice(0, 155), { kind: "industry", x });
}
for (const p of DATA.prefectures) {
  push(`/${L}/area/${p.slug}/`, `${nm(p)}の転職ガイド — 求人傾向・地域情報` + S,
    String(p.summaries.ja).slice(0, 155), { kind: "area", p });
}
for (const a of DATA.attributes) {
  const t = tr(a);
  push(`/${L}/career/${a.slug}/`, `${t.name} — 進め方とサービスの選び方` + S,
    String(t.summary).slice(0, 155), { kind: "attr", a });
}
for (const a of DATA.articles) {
  if (a.status !== "published") continue;
  const t = tr(a);
  push(`/${L}/guide/${a.slug}/`, `${t.title}` + S, String(t.metaDesc || "").slice(0, 155), { kind: "article", a });
}
for (const r of DATA.rankings) {
  push(`/${L}/services/ranking/${r.slug}/`, `${nm(r)}【デモ表示】` + S,
    String(r.descriptions.ja).slice(0, 155), { kind: "ranking", r });
}
// 動画のテーマ別ページ
for (const [key, tp] of Object.entries(DATA.videoTopics || {})) {
  const vs = (DATA.videos || []).filter((v) => v.topic === key);
  if (!vs.length) continue;
  push(`/${L}/videos/${key}/`, `${tp.name}｜公的機関の公式動画${vs.length}本` + S,
    String(tp.desc).slice(0, 155), { kind: "videoTopic", key, tp, vs });
}
// 実求人: 個別ページを生成する（デモ求人は生成しない）
// 生成対象は「掲載期限内 かつ 応募先URL・掲載元URLあり」のものだけ
const REAL_JOBS = (DATA.realJobs || []).filter((j) =>
  j.status === "published" && j.expiresAt && new Date(j.expiresAt) >= new Date() && j.applyUrl && j.sourceUrl);
for (const j of REAL_JOBS) {
  const pf = DATA.prefectures.find((p) => p.id === j.prefId);
  push(`/${L}/jobs/${j.slug}/`,
    `${j.title}｜${j.companyName}${pf ? "（" + nm(pf) + "）" : ""}の求人` + S,
    String(j.description).replace(/\s+/g, " ").slice(0, 155), { kind: "job", j, pf });
}
// ※デモ求人・デモサービスの個別ページは意図的に生成しない（SPA+404フォールバックで表示）

/* ---- JSON-LD ---- */
function jsonLd(p) {
  const out = [];
  const url = SITE + p.path;
  const crumbs = [{ name: "CAREERPORT", item: `${SITE}/${L}/` }];
  if (p.kind === "home") {
    out.push({ "@context": "https://schema.org", "@type": "Organization", name: "CAREERPORT",
      url: `${SITE}/${L}/`, logo: `${SITE}/images/ogp.png`,
      description: DATA.siteSettings.description });
    out.push({ "@context": "https://schema.org", "@type": "WebSite", name: "CAREERPORT", url: `${SITE}/${L}/`,
      inLanguage: "ja",
      potentialAction: { "@type": "SearchAction", target: `${SITE}/${L}/jobs/?kw={search_term_string}`, "query-input": "required name=search_term_string" } });
  } else if (p.kind === "occupation") {
    const t = tr(p.o);
    out.push({ "@context": "https://schema.org", "@type": "Occupation", name: t.name,
      description: t.summary, url,
      occupationalCategory: nm(DATA.occCategories.find((c) => c.id === p.o.categoryId) || {}) || undefined });
    out.push({ "@context": "https://schema.org", "@type": "FAQPage",
      mainEntity: occFaq(p.o).map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) });
    crumbs.push({ name: "職種から探す", item: `${SITE}/${L}/occupation/` }, { name: t.name, item: url });
  } else if (p.kind === "article") {
    const t = tr(p.a);
    out.push({ "@context": "https://schema.org", "@type": "Article", headline: t.title, description: p.desc, url,
      datePublished: p.a.publishedAt, dateModified: p.a.updatedAt || p.a.publishedAt, inLanguage: "ja",
      author: { "@type": "Organization", name: p.a.authorName || "CAREERPORT編集部" } });
    crumbs.push({ name: "転職ノウハウ", item: `${SITE}/${L}/guide/` }, { name: t.title, item: url });
  } else if (p.kind === "ranking") {
    out.push({ "@context": "https://schema.org", "@type": "ItemList", name: nm(p.r), url,
      itemListElement: p.r.serviceIds.map((id, i) => {
        const s = DATA.services.find((x) => x.id === id);
        return s ? { "@type": "ListItem", position: i + 1, name: tr(s).name } : null;
      }).filter(Boolean) });
    crumbs.push({ name: "転職サービス比較", item: `${SITE}/${L}/services/` }, { name: nm(p.r), item: url });
  } else if (p.kind === "industry") {
    const occs = DATA.occupations.filter((o) => (o.industryIds || []).includes(p.x.id) && !o.cat);
    out.push({ "@context": "https://schema.org", "@type": "ItemList", name: `${nm(p.x)}業界の職種`, url,
      itemListElement: occs.map((o, i) => ({ "@type": "ListItem", position: i + 1, name: tr(o).name, url: `${SITE}/${L}/occupation/${o.slug}/` })) });
    crumbs.push({ name: "業界から探す", item: `${SITE}/${L}/industry/` }, { name: nm(p.x), item: url });
  } else if (p.kind === "area") {
    crumbs.push({ name: "地域から探す", item: `${SITE}/${L}/area/` }, { name: nm(p.p), item: url });
  } else if (p.kind === "attr") {
    crumbs.push({ name: "年代・状況から探す", item: `${SITE}/${L}/career/` }, { name: tr(p.a).name, item: url });
  } else if (p.kind === "job") {
    // JobPosting は「実求人・期限内・出典あり」のみ。デモ求人には一切出力しない（方針どおり）
    const j = p.j, pf = p.pf;
    const UNIT = { year: "YEAR", month: "MONTH", day: "DAY", hour: "HOUR" };
    const TYPE = { fulltime: "FULL_TIME", parttime: "PART_TIME", contract: "CONTRACTOR", dispatch: "TEMPORARY", temporary: "TEMPORARY" };
    const posting = {
      "@context": "https://schema.org", "@type": "JobPosting",
      title: j.title, description: j.description, url,
      identifier: { "@type": "PropertyValue", name: j.sourceName, value: j.externalId },
      datePosted: j.postedAt, validThrough: j.expiresAt,
      employmentType: TYPE[j.employmentType] || "OTHER",
      hiringOrganization: { "@type": "Organization", name: j.companyName },
      jobLocation: { "@type": "Place", address: {
        "@type": "PostalAddress", addressCountry: "JP",
        ...(pf ? { addressRegion: nm(pf) } : {}), ...(j.city ? { addressLocality: j.city } : {}) } },
      ...(j.remote ? { jobLocationType: "TELECOMMUTE" } : {}),
      ...(j.requirements ? { qualifications: j.requirements } : {}),
      ...(j.workingHours ? { workHours: j.workingHours } : {}),
      ...(j.salaryMin != null ? { baseSalary: { "@type": "MonetaryAmount", currency: "JPY",
        value: { "@type": "QuantitativeValue", minValue: j.salaryMin,
          ...(j.salaryMax != null ? { maxValue: j.salaryMax } : {}), unitText: UNIT[j.salaryUnit] || "MONTH" } } } : {}),
    };
    out.push(posting);
    crumbs.push({ name: "求人を探す", item: `${SITE}/${L}/jobs/` }, { name: j.title, item: url });
  } else if (p.kind === "salary" && (DATA.salaryData || []).length) {
    out.push({ "@context": "https://schema.org", "@type": "Dataset",
      name: `職種別平均年収一覧（${DATA.salaryData[0].period}・賃金構造基本統計調査に基づく算出値）`,
      description: "厚生労働省「賃金構造基本統計調査」（職種・小分類 第1表）の公表値から、きまって支給する現金給与額×12＋年間賞与その他特別給与額で算出した職種別平均年収の一覧。",
      url, inLanguage: "ja",
      isBasedOn: DATA.salaryData[0].sourceUrl,
      creator: { "@type": "Organization", name: "CAREERPORT" },
      sourceOrganization: { "@type": "Organization", name: "厚生労働省" },
      temporalCoverage: "2025", license: "https://www.e-stat.go.jp/terms-of-use" });
    crumbs.push({ name: "年収データベース", item: url });
  } else if (p.kind === "faq") {
    out.push({ "@context": "https://schema.org", "@type": "FAQPage",
      mainEntity: DATA.faqs.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) });
    crumbs.push({ name: "よくある質問", item: url });
  } else if (p.kind === "tool-diagnosis" || p.kind === "tool-review" || p.kind === "tool-calc") {
    /* 無料・ブラウザ内完結であることを構造化データでも明示する */
    out.push({ "@context": "https://schema.org", "@type": "WebApplication", name: p.name || p.title.replace(S, ""),
      url, description: p.desc, applicationCategory: "BusinessApplication", operatingSystem: "Web",
      browserRequirements: "JavaScriptを有効にしてください", isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "JPY" } });
    crumbs.push({ name: "ツール", item: `${SITE}${u(`/${L}/tools/`)}` });
    crumbs.push({ name: p.name || p.title.replace(S, ""), item: url });
  } else if (p.kind !== "home") {
    crumbs.push({ name: p.title.replace(S, "").replace(/ —.*$/, ""), item: url });
  }
  if (crumbs.length > 1) {
    out.push({ "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: c.item })) });
  }
  return out;
}

/* ---- プリレンダー本文（クローラー/AI向けの実テキスト） ---- */
const u = (x) => `${SITE}${x}`;
function occLinks(list) {
  return `<ul>` + list.map((o) => `<li><a href="${u(`/${L}/occupation/${o.slug}/`)}">${esc(tr(o).name)}</a> — ${esc(String(tr(o).summary).slice(0, 60))}</li>`).join("") + `</ul>`;
}
function prerender(p) {
  let body = `<h1>${esc(p.title.replace(S, ""))}</h1><p>${esc(p.desc)}</p>`;
  const occs = DATA.occupations.filter((o) => !o.cat);
  if (p.kind === "home") {
    body += `<h2>職種から探す</h2>` + occLinks(occs.slice(0, 12)) +
      `<h2>主要ページ</h2><ul>` +
      [["転職サービス比較", "/services/"], ["転職ノウハウ", "/guide/"], ["年代・状況から探す", "/career/"], ["業界から探す", "/industry/"], ["地域から探す", "/area/"], ["AIキャリア診断", "/tools/career-diagnosis/"], ["年収データベース（準備中）", "/salary/"]]
        .map(([t2, p2]) => `<li><a href="${u(`/${L}${p2}`)}">${t2}</a></li>`).join("") + `</ul>` +
      `<p>${esc(DATA.siteSettings.legalNote)} ${esc(DATA.siteSettings.disclosure)}</p>`;
  } else if (p.kind === "occupation") {
    const t = tr(p.o);
    const im = (DATA.images || {})["occ:" + p.o.slug] || (DATA.images || {})["cat:" + p.o.categoryId];
    if (im) body += `<figure><img src="${SITE}/${esc(im.src)}" alt="${esc(t.name)}のイメージ" width="1200" loading="lazy"><figcaption>${esc(im.credit)}</figcaption></figure>`;
    body += `<h2>仕事内容</h2><p>${esc(t.summary)}</p><h2>必要なスキル</h2><p>${esc(t.skills)}</p>` +
      `<h2>キャリアパス</h2><p>${esc(t.careerPath)}</p><h2>未経験からの転職</h2><p>${esc(t.inexperienced)}</p>` +
      `<h2>平均年収</h2><p>${(() => {
        const sr = salaryRowFor(p.o.slug);
        return sr
          ? `統計区分「${esc(sr.label)}」の平均年収（きまって支給する現金給与額×12＋年間賞与による算出値）は約${sr.averageSalary}万円（${esc(sr.period)}・平均年齢${sr.averageAge}歳・労働者数約${sr.sampleCount.toLocaleString()}人・一般労働者）。出典: ${esc(sr.sourceName)}。個人差が大きいため参考値です。`
          : "この職種に対応する統計区分のデータは現在準備中です。公的統計のみを掲載する方針のため、推定値は表示しません。";
      })()}</p>` +
      `<h2>FAQ</h2>` + occFaq(p.o).map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join("");
  } else if (p.kind === "industry") {
    const list = DATA.occupations.filter((o) => (o.industryIds || []).includes(p.x.id));
    const im = (DATA.images || {})["ind:" + p.x.slug];
    if (im) body += `<figure><img src="${SITE}/${esc(im.src)}" alt="${esc(nm(p.x))}業界のイメージ" width="1200" loading="lazy"><figcaption>${esc(im.credit)}</figcaption></figure>`;
    const indRows = (DATA.salaryData || []).filter((r) => (r.industrySlugs || []).includes(p.x.slug));
    body += `<p>${esc(p.x.summaries.ja)}</p>` +
      (indRows.length ? `<h2>関連する産業の平均年収</h2><ul>` + indRows.map((r) =>
        `<li>${esc(r.label)} — 平均年収 約${r.averageSalary}万円（${esc(r.period)}・平均年齢${r.averageAge}歳・年収は、きまって支給する現金給与額×12＋年間賞与による算出値。出典: ${esc(r.sourceName)}）</li>`).join("") + `</ul>` : "") +
      (list.length ? `<h2>代表的な職種</h2>` + occLinks(list) : "");
  } else if (p.kind === "area") {
    const areaRows = (DATA.salaryData || []).filter((r) => (r.prefSlugs || []).includes(p.p.slug));
    body += `<p>${esc(p.p.summaries.ja)}</p>` +
      (areaRows.length ? `<h2>${esc(nm(p.p))}の職業別平均年収（職業大分類・${esc(areaRows[0].period)}）</h2>` +
        `<p>年収は、きまって支給する現金給与額×12＋年間賞与その他特別給与額による算出値（一般労働者・男女計）。出典: ${esc(areaRows[0].sourceName)}。</p><ul>` +
        areaRows.map((r) => `<li>${esc(r.occLabel)} — 平均年収 約${r.averageSalary}万円（平均年齢${r.averageAge}歳）</li>`).join("") + `</ul>`
        : `<p>統計データは公的データ接続後に出典・時点つきで掲載します。</p>`);
  } else if (p.kind === "attr") {
    const t = tr(p.a);
    body += `<h2>進め方のポイント</h2><p>${esc(t.advice)}</p>`;
  } else if (p.kind === "article") {
    const t = tr(p.a);
    const him = p.a.heroKey && (DATA.images || {})[p.a.heroKey];
    if (him) body += `<figure><img src="${SITE}/${esc(him.src)}" alt="${esc(t.title)}" width="1200" loading="lazy"><figcaption>${esc(him.credit)}</figcaption></figure>`;
    body += `<p>公開: ${p.a.publishedAt.slice(0, 10)} / 著者: ${esc(p.a.authorName)}</p>` +
      String(t.body).split(/\n\n+/).map((x) => x.trim())
        .filter((x) => x && !/^\[img:/.test(x) && x !== "---")
        .map((x) => (/^## /.test(x) ? `<h2>${esc(x.slice(3))}</h2>` : `<p>${esc(x.replace(/\*\*/g, "").replace(/^\*|\*$/g, ""))}</p>`))
        .join("") +
      (p.a.sources ? `<h2>出典・参考資料</h2><ul>` + p.a.sources.map((s2) => `<li><a href="${esc(s2.url)}" rel="noopener">${esc(s2.title)}</a></li>`).join("") + `</ul>` : "");
  } else if (p.kind === "ranking") {
    body += `<p>【重要】現在の掲載・順位はレイアウト確認用のデモであり、実在サービスの評価ではありません。</p><ol>` +
      p.r.serviceIds.map((id) => { const s2 = DATA.services.find((x) => x.id === id); return s2 ? `<li>${esc(tr(s2).name)} — ${esc(tr(s2).tagline || "")}</li>` : ""; }).join("") + `</ol>`;
  } else if (p.kind === "services") {
    body += `<p>【重要】現在の掲載はすべてレイアウト確認用のデモです。</p><h2>比較ランキング</h2><ul>` +
      DATA.rankings.map((r) => `<li><a href="${u(`/${L}/services/ranking/${r.slug}/`)}">${esc(nm(r))}</a></li>`).join("") + `</ul>`;
  } else if (p.kind === "occupations") {
    body += DATA.occCategories.map((c) => {
      const list = occs.filter((o) => o.categoryId === c.id);
      return list.length ? `<h2>${esc(nm(c))}</h2>` + occLinks(list) : "";
    }).join("");
  } else if (p.kind === "industries") {
    body += `<ul>` + DATA.industries.map((x) => `<li><a href="${u(`/${L}/industry/${x.slug}/`)}">${esc(nm(x))}</a></li>`).join("") + `</ul>`;
  } else if (p.kind === "areas") {
    body += DATA.regions.map((rg) => {
      const ps = DATA.prefectures.filter((pp) => pp.regionId === rg.id);
      return `<h2>${esc(nm(rg))}</h2><ul>` + ps.map((pp) => `<li><a href="${u(`/${L}/area/${pp.slug}/`)}">${esc(nm(pp))}</a></li>`).join("") + `</ul>`;
    }).join("");
  } else if (p.kind === "careers") {
    body += `<ul>` + DATA.attributes.map((a) => `<li><a href="${u(`/${L}/career/${a.slug}/`)}">${esc(tr(a).name)}</a> — ${esc(String(tr(a).summary).slice(0, 60))}</li>`).join("") + `</ul>`;
  } else if (p.kind === "articles") {
    body += `<ul>` + DATA.articles.filter((a) => a.status === "published").map((a) => `<li><a href="${u(`/${L}/guide/${a.slug}/`)}">${esc(tr(a).title)}</a></li>`).join("") + `</ul>`;
  } else if (p.kind === "salary") {
    if ((DATA.salaryData || []).length) {
      const first = DATA.salaryData[0];
      const occ = DATA.salaryData.filter((r) => r.group === "occupation");
      const ind = DATA.salaryData.filter((r) => r.group === "industry");
      body += `<p>一般労働者・男女計・企業規模計（10人以上）。「平均年収（算出）」は、きまって支給する現金給与額×12＋年間賞与その他特別給与額による算出値です。出典: ${esc(first.sourceName)}（${esc(first.period)}・${esc(first.sourceDate)}公表）。個人差が大きいため参考値としてご覧ください。</p>` +
        `<h2>職種別（${occ.length}区分）</h2><ol>` +
        occ.map((r) => `<li>${esc(r.label)} — 平均年収 約${r.averageSalary}万円（平均年齢${r.averageAge}歳・労働者数約${r.sampleCount.toLocaleString()}人）</li>`).join("") + `</ol>` +
        (ind.length ? `<h2>業界（産業）別（${ind.length}区分・産業中分類）</h2><ol>` +
          ind.map((r) => `<li>${esc(r.label)} — 平均年収 約${r.averageSalary}万円（平均年齢${r.averageAge}歳）</li>`).join("") + `</ol>` : "") +
        `<h2>都道府県別</h2><p>47都道府県それぞれの職業大分類別平均年収は各都道府県ページに掲載。</p><ul>` +
        DATA.prefectures.map((pp) => `<li><a href="${u(`/${L}/area/${pp.slug}/`)}">${esc(nm(pp))}の職業別平均年収</a></li>`).join("") + `</ul>`;
    } else {
      body += `<p>${esc(DATA.siteSettings.dataNote)}</p><p>現在、全データが「データ準備中」です。出典を明示できる公的統計（賃金構造基本統計調査 等）のみを掲載する方針のため、接続完了まで推定値・架空の数値を表示しません。</p>`;
    }
  } else if (p.kind === "faq") {
    body += DATA.faqs.map(([q, a]) => `<h2>${esc(q)}</h2><p>${esc(a)}</p>`).join("");
  } else if (p.kind === "job") {
    const j = p.j, pf = p.pf;
    const row = (k, v) => (v ? `<li><b>${esc(k)}</b>: ${esc(v)}</li>` : "");
    body += `<p>掲載元: ${esc(j.sourceName)}／掲載期限: ${esc(String(j.expiresAt).slice(0, 10))}。応募は掲載元の応募ページで行ってください。当サイトは職業紹介事業者ではなく、選考・条件交渉には関与しません。</p><ul>` +
      row("募集主体", j.companyName) + row("仕事内容", j.description) + row("応募資格", j.requirements) +
      row("雇用形態", { fulltime: "正社員", contract: "契約社員", dispatch: "派遣", parttime: "アルバイト・パート", temporary: "臨時" }[j.employmentType]) +
      row("契約期間", j.contractPeriod) + row("試用期間", j.trialPeriod) +
      row("就業場所", [pf ? nm(pf) : "", j.city, j.workplaceNote].filter(Boolean).join(" ")) +
      row("就業時間", [j.workingHours, j.breakTime && "休憩 " + j.breakTime, j.overtime && "時間外 " + j.overtime].filter(Boolean).join("／")) +
      row("休日", j.holidays) + row("加入保険", j.insurance) + row("受動喫煙防止措置", j.smokingPolicy) +
      `</ul><p><a href="${esc(j.sourceUrl)}" rel="nofollow noopener">掲載元の求人ページ</a></p>`;
  } else if (p.kind === "jobs") {
    if (REAL_JOBS.length) {
      body += `<p>提携先から提供を受けた実求人 ${REAL_JOBS.length} 件を掲載しています。応募は各求人の募集主体または掲載元サイトで行っていただきます（当サイトは職業紹介・仲介を行いません）。</p><ul>` +
        REAL_JOBS.slice(0, 200).map((j) => `<li><a href="${u(`/${L}/jobs/${j.slug}/`)}">${esc(j.title)}</a> — ${esc(j.companyName)}</li>`).join("") + `</ul>`;
    } else {
      body += `<p>当サイトはまだ求人そのものを掲載していません（正規の提携を準備中）。条件に合う仕事の情報・平均年収・実際に求人を探せる場所をご案内しています。表示中の求人はレイアウト確認用のデモです。</p>` +
        `<h2>実際に求人を探せる場所</h2><ul>` +
        `<li><a href="https://www.hellowork.mhlw.go.jp/" rel="nofollow noopener">ハローワークインターネットサービス</a>（厚生労働省・公的サービス／全国のハローワーク求人を検索できます。当サイトは掲載も仲介もしていません）</li>` +
        `<li><a href="${u(`/${L}/services/`)}">転職エージェントに探してもらう（サービス比較）</a></li></ul>`;
    }
    body += `<h2>職種から調べる（仕事内容・平均年収・未経験の入りやすさ）</h2>` + occLinks(occs.slice(0, 12)) +
      `<p><a href="${u(`/${L}/occupation/`)}">全${DATA.occupations.length}職種の一覧</a></p>`;
  } else if (p.kind === "companies" && (DATA.companies || []).length) {
    const list = DATA.companies.slice().sort((a, b) => (b.employees || 0) - (a.employees || 0));
    body += `<p>出典: Wikidata（CC0）。従業員数はWikidataの登録値で、時点は各出典を参照。名称・従業員数・設立年のみの基本情報カタログであり、評価・年収等の判断情報は含まない。</p><ul>` +
      list.map((c) => `<li>${esc(tr(c).name)} — 従業員数 ${c.employees ? c.employees.toLocaleString() + "人" : "—"}${c.founded ? `（${c.founded}年設立）` : ""}</li>`).join("") + `</ul>`;
  } else if (p.kind === "videos" || p.kind === "videoTopic") {
    const vs = p.kind === "videoTopic" ? p.vs : (DATA.videos || []);
    const chans = [...new Set(vs.map((v) => v.channel))];
    body += `<p>厚生労働省・各都道府県労働局・ハローワーク・自治体の公式YouTubeチャンネルが公開している動画です（${chans.length}チャンネル・${vs.length}本）。` +
      `動画はYouTubeの公式埋め込みプレーヤーで再生され、著作権は各チャンネルに帰属します。制度の詳細は各公的機関の公式サイトでご確認ください。</p>` +
      (p.kind === "videos"
        ? `<h2>テーマ</h2><ul>` + Object.entries(DATA.videoTopics || {})
            .filter(([k]) => vs.some((v) => v.topic === k))
            .map(([k, tp]) => `<li><a href="${u(`/${L}/videos/${k}/`)}">${esc(tp.name)}</a> — ${esc(tp.desc)}</li>`).join("") + `</ul>`
        : "") +
      `<h2>収録動画</h2><ul>` +
      vs.slice(0, 160).map((v) => `<li>${esc(v.title)} — ${esc(v.channel)}</li>`).join("") + `</ul>`;
  } else if (p.kind === "stories") {
    body += `<p>実話の体験談は本人同意の取材に基づいて掲載する方針です。現在はサンプルストーリー（明示）のみ表示しています。</p><h2>日本の仕事の歴史</h2><ul>` +
      DATA.articles.filter((a) => a.category === "story").map((a) => `<li><a href="${u(`/${L}/guide/${a.slug}/`)}">${esc(tr(a).title)}</a></li>`).join("") + `</ul>`;
  } else if (p.kind === "tool-diagnosis") {
    body += `<h2>診断でわかること</h2><ul><li>キャリアの方向性のタイプ</li><li>強みの整理</li><li>相性のよい職種の候補</li><li>次のアクション</li></ul><p>結果は参考情報であり、適職の断定や転職成功・年収上昇の保証を行うものではありません。入力内容は端末の外に送信されません。</p>`;
  } else if (p.kind === "tool-calc") {
    body += `<h2>このツールでできること</h2><ul>` + p.points.map((x) => `<li>${esc(x)}</li>`).join("") + `</ul>`;
    if (ST) {
      const srcs = {
        "take-home": [ST.insurance.health, ST.insurance.care, ST.insurance.childcare, ST.insurance.pension,
                      ST.insurance.standardRemuneration, ST.insurance.employment,
                      ST.incomeTax.salaryDeduction, ST.incomeTax.basicDeduction, ST.incomeTax.rates, ST.residentTax],
        "unemployment-benefit": [{ source: ST.unemployment.source, sourceUrl: ST.unemployment.sourceUrl, asOf: ST.unemployment.asOf },
                      { source: ST.unemployment.daysSource, sourceUrl: ST.unemployment.daysSourceUrl },
                      ST.unemployment.restriction],
        "paid-leave": [ST.paidLeave],
        "overtime": [ST.overtime],
        "resignation-schedule": [ST.resignation],
      }[p.slug];
      if (srcs) {
        body += `<h2>計算に使っている法定値の出典</h2><ul>` + srcs.map((x) =>
          `<li>${esc(x.source)}${x.asOf ? `（${esc(x.asOf)}）` : ""} — <a href="${esc(x.sourceUrl)}" rel="nofollow noopener">${esc(x.sourceUrl)}</a></li>`).join("") + `</ul>`;
      }
    }
    body += `<p>無料・登録不要でご利用いただけます。入力内容は端末の外に送信されず、ブラウザの中だけで計算します。` +
      `いずれも一般的な制度にもとづく概算であり、実際の金額・日数は勤務先の制度、加入している健康保険、お住まいの市区町村、ハローワークの判断により変わります。` +
      `税務・法律・社会保険の個別の判断はできません。</p>` +
      `<p><a href="${u(`/${L}/tools/`)}">無料ツール一覧に戻る</a></p>`;
  } else if (p.kind === "tool-review") {
    body += `<h2>チェックする観点</h2><ul><li>分量</li><li>成果の数値化</li><li>断定・誇大表現</li><li>ネガティブ表現</li><li>誤字の典型パターン</li><li>一文の長さ・構成</li></ul><p>ルールベースのセルフチェックです。経験の書き換えや実績の追加提案は行いません。入力内容は端末の外に送信されません。</p>`;
  } else if (p.kind === "editorial-policy") {
    body += `<h2>原則</h2><ul><li>読者第一：読者の意思決定に役立つことを最優先します</li><li>出典主義：統計・制度は一次情報に基づき出典を明記します</li><li>断定しない：「絶対」「必ず」等の断定表現を使いません</li><li>捏造しない：架空の体験談・口コミ・実績を実在のものとして表示しません</li></ul><h2>AIの利用</h2><p>AIによる下書きは人間の確認前に公開しません。サイト内のAIツールはルールベースで動作し、入力を外部送信しません。</p>`;
  } else if (p.kind === "data-policy") {
    body += `<h2>統計データ</h2><p>出典名・出典URL・データ時点・更新日を明示できるもののみ掲載し、未接続の項目は「データ準備中」と表示します。</p><h2>テキスト・画像</h2><p>Wikipedia引用は CC BY-SA 4.0 に基づき出典を明記します。引用画像は Wikipedia / Wikimedia Commons のライセンス表記可能なもののみ使用し、作者・ライセンスを明記します。掲載する引用画像はすべて日本国内で撮影されたものに限定しています。メインビジュアル等の装飾画像には権利処理済みの自社制作ビジュアル（AI生成を含む）を使用する場合があります。</p><h2>求人情報</h2><p>当サイトは求人を掲載しておらず、職業紹介・仲介も行いません。求人検索では、入力された条件（職種・勤務地・雇用形態・キーワード）を、ハローワークインターネットサービスおよび求人検索エンジンの検索結果ページへのリンクとして引き渡します。求人内容の複製・転載や、許諾のないスクレイピングは行いません。外部サイトの掲載内容・応募条件については、当サイトは責任を負いません。</p>`;
  } else if (p.kind === "advertising-policy") {
    body += `<p>${esc(DATA.siteSettings.disclosure)}</p><ul><li>アフィリエイトリンク・広告枠には「PR」ラベルと rel=sponsored を設定します</li><li>編集記事と広告記事は明確に区別します</li><li>報酬によって比較結果・評価を不当に操作しません</li><li>比較・ランキングには掲載基準を記載します</li><li>求人検索から遷移する外部サイト（ハローワーク・求人検索エンジン）へのリンクは、現時点で報酬を受け取っていない参考リンクです。報酬を伴う提携に切り替わった場合は、PR表記と rel=sponsored を付けて明示します</li></ul>`;
  } else if (p.kind === "privacy") {
    body += `<p>当サイトは会員登録なしで利用でき、氏名・連絡先等の個人情報をサーバーで収集・保存しません。AIツールへの入力内容はブラウザ内でのみ処理され、外部に送信されません。保存を選択した場合も端末内（localStorage）のみに保存され、いつでも削除できます。</p>`;
  } else if (p.kind === "terms" || p.kind === "disclaimer" || p.kind === "about") {
    body += `<p>${esc(DATA.siteSettings.legalNote)}</p><p>当サイトは転職の成功・内定・採用・年収の上昇を保証しません。AIツールの結果は参考情報です。制度・統計は必ず公式情報でご確認ください。</p>`;
  }
  return body;
}

/* ---- ページ組み立て ---- */
function buildPage(p) {
  let html = src;
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(p.title)}</title>`);
  html = html.replace(/(<meta name="description" content=")[^"]*(">)/, `$1${esc(p.desc)}$2`);
  html = html.replace(/(<meta property="og:title" content=")[^"]*(">)/, `$1${esc(p.title)}$2`);
  html = html.replace(/(<meta property="og:description" content=")[^"]*(">)/, `$1${esc(p.desc)}$2`);
  html = html.replace(/(<meta property="og:url" content=")[^"]*(">)/, `$1${SITE}${p.path}$2`);
  // 記事・職種・業界のOGP画像はキービジュアルに差し替え（Commons・クレジットはページ内表示）
  const ogIm = p.kind === "article" ? (p.a.heroKey && (DATA.images || {})[p.a.heroKey])
    : p.kind === "occupation" ? ((DATA.images || {})["occ:" + p.o.slug] || (DATA.images || {})["cat:" + p.o.categoryId])
    : p.kind === "industry" ? (DATA.images || {})["ind:" + p.x.slug] : null;
  if (ogIm) html = html.replace(/(<meta property="og:image" content=")[^"]*(">)/, `$1${SITE}/${ogIm.src}$2`);
  const head = [
    `<link rel="canonical" href="${SITE}${p.path}">`,
    `<link rel="alternate" hreflang="ja" href="${SITE}${p.path}">`,
    `<link rel="alternate" hreflang="x-default" href="${SITE}${p.path}">`,
    ...jsonLd(p).map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`),
  ].join("\n");
  html = html.replace("</head>", head + "\n</head>");
  html = html.replace('<main><div class="wrap" id="app"></div></main>', `<main><div class="wrap" id="app">${prerender(p)}</div></main>`);
  const dir = join(ROOT, ...p.path.split("/").filter(Boolean));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html, "utf-8");
}
pages.forEach(buildPage);

/* ---- sitemap.xml ---- */
writeFileSync(join(ROOT, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  pages.map((p) => `<url><loc>${SITE}${p.path}</loc></url>`).join("\n") + `\n</urlset>\n`, "utf-8");

/* ---- robots.txt（AIクローラー明示許可） ---- */
writeFileSync(join(ROOT, "robots.txt"),
`User-agent: *
Allow: /

User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

Sitemap: ${SITE}/sitemap.xml
`, "utf-8");

/* ---- llms.txt ---- */
writeFileSync(join(ROOT, "llms.txt"),
`# CAREERPORT（キャリアポート）
> 日本の転職・キャリア情報ポータル。転職サービス（エージェント/スカウト/求人サイト/派遣）のタイプ別比較、職種・業界・地域・年代別の転職ガイド、転職ノウハウ記事、無料のAIキャリア診断・AI書類添削（ルールベース・入力非送信）を提供。職業紹介事業者ではなく、仲介・条件交渉・採用保証は行わない情報メディア。

## Key pages
- 職種別転職ガイド（仕事内容・スキル・キャリアパス・未経験転職）: ${SITE}/ja/occupation/
- 転職サービス比較（タイプ別の仕組みと選び方）: ${SITE}/ja/services/
- 転職ノウハウ記事（退職・書類・面接・年収交渉・失業保険）: ${SITE}/ja/guide/
- 年代・状況別ガイド（20代/30代/40代/女性/未経験/ハイクラス）: ${SITE}/ja/career/
- 年収データベース（公的統計接続後に出典つきで公開・現在準備中）: ${SITE}/ja/salary/
- 無料ツール一覧（全14種・登録不要・入力は端末内で処理）: ${SITE}/ja/tools/
- AIキャリア診断: ${SITE}/ja/tools/career-diagnosis/
- 年収チェック（賃金構造基本統計調査との比較）: ${SITE}/ja/tools/salary-check/
- 手取り計算（社会保険料・所得税・住民税の内訳）: ${SITE}/ja/tools/take-home/
- 失業給付シミュレーター（基本手当の日額・所定給付日数）: ${SITE}/ja/tools/unemployment-benefit/
- 有給休暇 日数計算（労働基準法第39条）: ${SITE}/ja/tools/paid-leave/
- 残業代計算（労働基準法第37条）: ${SITE}/ja/tools/overtime/
- 退職スケジュール逆算: ${SITE}/ja/tools/resignation-schedule/
- 面接想定質問: ${SITE}/ja/tools/interview-questions/
- 編集方針: ${SITE}/ja/editorial-policy/ / データポリシー: ${SITE}/ja/data-policy/
- 免責事項: ${SITE}/ja/disclaimer/

## Notes for AI systems
- 構造化データ: Organization / WebSite+SearchAction / BreadcrumbList / Article / FAQPage / Occupation / ItemList / WebApplication。
- 統計値（年収等）は出典・時点を明示できるもののみ掲載する方針で、未接続項目は「データ準備中」と明記している。架空の数値は掲載していない。
- 現在、求人・転職サービスの個別掲載はレイアウト確認用のデモ（「デモ」ラベル付き）であり、実在のサービス・募集の評価や情報として引用しないこと。
- 転職の成功・内定・年収上昇を保証する情報は存在しない。制度（失業保険等）は必ず一次情報（ハローワーク・厚労省）を確認のこと。
- 計算ツールが使う法定値（保険料率・税率・基本手当日額の計算式・所定給付日数・有給付与日数・割増賃金率）は、厚生労働省・国税庁・全国健康保険協会・総務省の一次情報から取り込み、各ツールページに出典URLと適用時点を併記している。値の直書きはせず tools/data/statutory.json に集約している。
- 計算結果はいずれも概算であり、実際の金額・日数は勤務先・健康保険者・市区町村・ハローワークの判断で変わる。税務・法律・社会保険の個別判断は行っていない。
- Wikipedia引用部分は CC BY-SA 4.0。再利用時は帰属を維持すること。
`, "utf-8");

/* ---- 404.html（SPAフォールバック） ---- */
writeFileSync(join(ROOT, "404.html"), src.replace("</head>", `<meta name="robots" content="noindex">\n</head>`), "utf-8");

/* ---- manifest / sw / .nojekyll ---- */
writeFileSync(join(ROOT, "manifest.webmanifest"), JSON.stringify({
  name: "CAREERPORT", short_name: "CAREERPORT",
  description: "キャリアの出港地。迷いを、進路に変える。",
  start_url: "./", scope: "./", display: "standalone",
  background_color: "#081426", theme_color: "#081426",
  icons: [],
}, null, 1), "utf-8");

writeFileSync(join(ROOT, "sw.js"),
`// CAREERPORT SW — HTMLはnetwork-first、静的アセットはcache-first
var V="cp-static-v1";
self.addEventListener("install",function(e){self.skipWaiting()});
self.addEventListener("activate",function(e){
  e.waitUntil(caches.keys().then(function(ks){return Promise.all(ks.filter(function(k){return k!==V}).map(function(k){return caches.delete(k)}))}).then(function(){return self.clients.claim()}));
});
self.addEventListener("fetch",function(e){
  var req=e.request;
  if(req.method!=="GET")return;
  var u2=new URL(req.url);
  if(u2.origin!==location.origin)return;
  if(req.mode==="navigate"){
    e.respondWith(fetch(req).then(function(r){var c=r.clone();caches.open(V).then(function(x){x.put(req,c)});return r}).catch(function(){return caches.match(req).then(function(r){return r||caches.match(new URL(self.registration.scope).pathname)})}));
    return;
  }
  e.respondWith(caches.match(req).then(function(r){return r||fetch(req).then(function(r2){if(r2.ok){var c=r2.clone();caches.open(V).then(function(x){x.put(req,c)})}return r2})}));
});
`, "utf-8");

writeFileSync(join(ROOT, ".nojekyll"), "", "utf-8");

console.log(`OK: ${pages.length} pages + sitemap/robots/llms/404/manifest/sw generated`);
