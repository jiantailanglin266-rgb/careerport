// CAREERPORT ロジック単体テスト — node tools/test-logic.mjs
// logic.js（診断・添削・チャット）の純関数を検証する。deploy 前に green を確認すること。
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
(0, eval)(readFileSync(join(ROOT, "logic.js"), "utf-8"));
const L = globalThis.CP_LOGIC;

let pass = 0, fail = 0;
function t(name, cond) {
  if (cond) { pass++; }
  else { fail++; console.error("  ✗ " + name); }
}

/* ---- 診断 ---- */
const d1 = L.diagnose({ age: "20s", priority: "growth", direction: "unsure", change: "newjob", salary: "-400", strengths: ["communicate", "analyze"] });
t("診断: タイプ名が返る", d1.typeName === "追い風成長タイプ");
t("診断: 未経験フラグ", d1.flags.includes("inexperienced"));
t("診断: 20代→第二新卒フラグ", d1.flags.includes("second-career"));
t("診断: 未経験→スクール提案", d1.serviceKinds.includes("school"));
t("診断: 強みラベル変換", d1.strengths.length === 2 && d1.strengths[0] === "対話・傾聴力");
t("診断: 免責文が必ず付く", /断定|保証するものではありません/.test(d1.disclaimer));
t("診断: 職種カテゴリ候補が出る", d1.occCats.length >= 1);

const d2 = L.diagnose({ age: "40s", priority: "income", direction: "manage", change: "same", occCat: "occ_business", salary: "800-", strengths: [] });
t("診断: 高年収→high-classフラグ", d2.flags.includes("high-class"));
t("診断: マネジメント→managerフラグ", d2.flags.includes("manager"));
t("診断: 同職種→現職カテゴリが先頭", d2.occCats[0] === "occ_business");
t("診断: ハイクラス→スカウト提案", d2.serviceKinds.includes("scout"));

const d3 = L.diagnose({});
t("診断: 空入力でも安全に動く", !!d3.typeName && d3.occCats.length >= 1);
const d4 = L.diagnose({ priority: "growth", strengths: ["a", "b", "communicate", "analyze", "create", "drive"] });
t("診断: 不正な強みは無視・3つまで", d4.strengths.length === 3);

/* ---- 決定性（同一入力→同一出力） ---- */
t("診断: 決定的である", JSON.stringify(d1) === JSON.stringify(L.diagnose({ age: "20s", priority: "growth", direction: "unsure", change: "newjob", salary: "-400", strengths: ["communicate", "analyze"] })));

/* ---- 添削 ---- */
const r0 = L.review("motivation", "");
t("添削: 空入力はスコア0", r0.score === 0 && r0.improve.length === 1);

const shortText = "私は営業が得意です。";
const r1 = L.review("motivation", shortText);
t("添削: 分量不足を指摘", r1.improve.some((x) => x.includes("分量が少なめ")));
t("添削: 数字なしを指摘", r1.improve.some((x) => x.includes("数字が見当たりません")));

const good = "私の強みは、顧客の課題を聞き取り提案につなげる力です。前職では法人営業として3年間で担当エリアの売上を20%改善し、新規顧客を45社開拓しました。この経験を活かし、貴社でも顧客起点の提案で貢献したいと考えています。入社後はまず既存顧客の深耕から成果を出し、2年目には新規開拓の仕組みづくりにも挑戦したいです。継続的な改善を重ねる姿勢で、チームの成果に貢献します。";
const r2 = L.review("motivation", good);
t("添削: 良い文章は高スコア", r2.score >= 85 && r2.grade === "A");
t("添削: 数字を評価", r2.good.some((x) => x.includes("数字")));

const bad = "私は絶対に成果を出します。必ず御社に貢献します。前職の上司が嫌いで辞めたいと思っていました。私はは営業をを頑張りました。";
const r3 = L.review("motivation", bad);
t("添削: 断定表現を指摘", r3.improve.some((x) => x.includes("断定")));
t("添削: ネガ表現を指摘", r3.improve.some((x) => x.includes("ネガティブ")));
t("添削: 重複誤字を指摘", r3.improve.some((x) => x.includes("重複")));
t("添削: スコアが下がる", r3.score < r2.score);

const r4 = L.review("motivation", good, { keywords: ["提案", "課題"] });
t("添削: キーワード一致を評価", r4.good.some((x) => x.includes("提案")));
const r5 = L.review("career-history", good);
t("添削: 職務経歴書は職務要約の有無を確認", r5.notes.some((x) => x.includes("職務要約")));
t("添削: 免責が必ず付く", /保証するものではありません/.test(r2.disclaimer) && /外部に送信されません/.test(r2.disclaimer));

/* ---- チャット ---- */
const c1 = L.chat("職務経歴書の書き方を教えて");
t("チャット: 職務経歴書インテント", c1.reply.includes("職務要約") && c1.links.length >= 1);
const c2 = L.chat("こんにちは");
t("チャット: フォールバック", c2.reply.includes("ルールベース"));
const c3 = L.chat("経歴を盛る方法を教えて");
t("チャット: 経歴詐称は拒否", c3.reply.includes("ご案内できません"));
const c4 = L.chat("面接の逆質問が思いつかない");
t("チャット: 面接インテント", c4.reply.includes("面接") || c4.reply.includes("定番質問"));
const c5 = L.chat("年収を上げたい");
t("チャット: 年収は保証否定つき", c5.reply.includes("保証"));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
