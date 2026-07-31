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


/* ---- AIキャリアエージェント ---- */
const OCCS=[{slug:"sales",name:"営業",categoryId:"occ_business",featured:true},
            {slug:"nurse",name:"看護師",categoryId:"occ_medical",featured:true}];
const CTX={
  occupations:OCCS,
  occupationBySlug:(sl)=>OCCS.find(o=>o.slug===sl)||null,
  salaryFor:(sl)=>sl==="sales"?{label:"その他の営業職業従事者",averageSalary:661,averageAge:42.4,period:"令和7年（2025年）調査"}:null
};
let st=L.agentInit();
t("エージェント: 初期状態は未完了", !st.done && Object.keys(st.slots).length===0);
let ag1=L.agentStep(st,{__key:"income"},CTX);
t("エージェント: 1問目でintentが埋まる", st.slots.intent==="income" && !ag1.done);
t("エージェント: 次は職種を聞く", ag1.slot==="occupation");
t("エージェント: 意図に応じた反応を返す", /年収/.test(ag1.react));
let ag2=L.agentStep(st,{__key:"sales"},CTX);
t("エージェント: 職種で統計を提示", /661万円/.test(ag2.react) && /その他の営業職業従事者/.test(ag2.react));
t("エージェント: 統計の平均年齢を明示", /平均年齢42.4歳/.test(ag2.react));
L.agentStep(st,{__key:"30s"},CTX);
let ag4=L.agentStep(st,{__key:"400-500"},CTX);
t("エージェント: 年収を統計と比較", /平均/.test(ag4.react) && /%/.test(ag4.react));
t("エージェント: 単純比較できない旨を添える", /断定はできません|単純比較/.test(ag4.react));
L.agentStep(st,{__key:"income"},CTX);
let last=L.agentStep(st,{__key:"half"},CTX);
t("エージェント: 6問で完了", last.done===true && !!last.result);
const R=last.result;
t("カルテ: タイプ名", R.typeName==="航路開拓タイプ");
t("カルテ: 年収ベンチマークを持つ", !!R.salaryLine && R.salaryLine.avg===661 && R.salaryLine.mine===450);
t("カルテ: 次のアクションが具体的リンク", R.actions.length>=3 && R.actions.every(a=>a.go && a.label));
t("カルテ: 現職カテゴリを引き継ぐ", R.occCats.includes("occ_business"));
t("カルテ: 免責が必ず付く", /保証するものではありません/.test(R.disclaimer) && /外部に送信されることはありません/.test(R.disclaimer));

let st2=L.agentInit();
L.agentStep(st2,"年収を上げたい",CTX);
t("エージェント: 自由入力から選択肢を解釈", st2.slots.intent==="income");
L.agentStep(st2,"営業をやっています",CTX);
t("エージェント: 自由入力から職種を推測", st2.slots.occupation==="sales");
L.agentStep(st2,"35歳です",CTX);
t("エージェント: 年齢の自由入力を解釈", st2.slots.age==="30s");
L.agentStep(st2,"だいたい420万円くらい",CTX);
t("エージェント: 金額の自由入力を解釈", st2.slots.salary==="400-500");

let st3=L.agentInit();
let q=L.agentStep(st3,"職務経歴書の書き方を教えて",CTX);
t("エージェント: 無関係な質問には相談で応答", q.reask===true && /職務要約/.test(q.aside.reply));
t("エージェント: 質問中はスロットを埋めない", st3.slots.intent===undefined);

let st4=L.agentInit();
L.agentStep(st4,{__key:"undecided"},CTX);
L.agentStep(st4,{__key:"nurse"},CTX);
L.agentStep(st4,{__key:"20s"},CTX);
let sk=L.agentStep(st4,"スキップ",CTX);
t("エージェント: スキップを受け付ける", st4.slots.salary==="__skip__");
t("エージェント: スキップ時は年収比較を出さない", !/万円/.test(sk.react||""));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
