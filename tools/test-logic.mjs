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

/* ---- 無料ツール（法定計算） ----
   数値は tools/data/statutory.json（官公庁の一次情報）から読む。
   公表値との一致・表の内部整合をテストで固定し、改定ミスを検知する。 */
const S = JSON.parse(readFileSync(join(ROOT, "tools/data/statutory.json"), "utf-8"));

/* 失業給付：計算式が公表の上限額・最低額と一致するか（厚労省の表と突き合わせ） */
t("失業: 最低額は2,411円（賃金日額下限3,014円×80%）", L._dailyBenefit(S.unemployment, S.unemployment.ageBands[0], 3014) === 2411);
for (const b of S.unemployment.ageBands) {
  t(`失業: ${b.label} 上限額が公表値と一致`, L._dailyBenefit(S.unemployment, b, b.cap + 1) === b.maxDaily);
  t(`失業: ${b.label} 上限直前も公表の上限額に一致（式の連続性）`, L._dailyBenefit(S.unemployment, b, b.cap) === b.maxDaily);
  t(`失業: ${b.label} 逓減式と定率式が境界で連続`, Math.abs(L._dailyBenefit(S.unemployment, b, b.w2) - Math.floor(b.rate2 * b.w2)) <= 1);
}
const ub1 = L.unemploymentBenefit(S, { age: 35, monthlyWage: 300000, insuredYears: 8, reason: "self" });
t("失業: 賃金日額=月給/30", ub1.wageDaily === 10000);
t("失業: 自己都合10年未満は90日", ub1.days === 90);
t("失業: 給付制限は原則1か月", ub1.restrictionMonths === 1);
t("失業: 総額＝日額×日数", ub1.total === ub1.daily * ub1.days);
t("失業: 給付率は50〜80%に収まる", ub1.rate >= 0.5 && ub1.rate <= 0.8);
const ub2 = L.unemploymentBenefit(S, { age: 35, monthlyWage: 300000, insuredYears: 8, reason: "company" });
t("失業: 会社都合35〜45歳・5〜10年は180日", ub2.days === 180);
t("失業: 会社都合は給付制限なし", ub2.restrictionMonths === 0);
const ub3 = L.unemploymentBenefit(S, { age: 50, monthlyWage: 600000, insuredYears: 25, reason: "company" });
t("失業: 45〜60歳・20年以上は330日", ub3.days === 330);
t("失業: 高賃金は上限額でキャップ", ub3.daily === 8870);
const ub4 = L.unemploymentBenefit(S, { age: 66, monthlyWage: 300000, insuredYears: 10, reason: "self" });
t("失業: 65歳以上は高年齢求職者給付金を案内", ub4.eligible === false && /高年齢求職者給付金/.test(ub4.message));
const ub5 = L.unemploymentBenefit(S, { age: 28, monthlyWage: 200000, insuredYears: 0.5, reason: "self" });
t("失業: 被保険者期間1年未満は受給資格を警告", ub5.warnings.some((x) => x.includes("受給資格")));
t("失業: 再離職は給付制限3か月", L.unemploymentBenefit(S, { age: 35, monthlyWage: 300000, insuredYears: 8, reason: "self", repeat: true }).restrictionMonths === 3);
t("失業: 免責が必ず付く", /保証するものではありません/.test(ub1.disclaimer));

/* 手取り計算 */
t("標準報酬月額: 30万円→30万等級", L._standardMonthly(S, 300000) === 300000);
t("標準報酬月額: 29.5万円は29万〜31万の区分で30万等級", L._standardMonthly(S, 295000) === 300000);
t("標準報酬月額: 下限58,000円", L._standardMonthly(S, 10000) === 58000);
t("標準報酬月額: 上限1,390,000円", L._standardMonthly(S, 5000000) === 1390000);
t("給与所得控除: 年収500万→144万（500万×20%+44万）", L._salaryDeduction(S, 5000000) === 1440000);
t("給与所得控除: 年収1,000万は上限195万", L._salaryDeduction(S, 10000000) === 1950000);
t("給与所得控除: 年収180万は65万（令和7年分以降）", L._salaryDeduction(S, 1800000) === 650000);
const th = L.takeHome(S, { annual: 5000000, bonus: 1000000, age: 30, prefSlug: "tokyo", dependents: 0 });
t("手取り: 東京の健康保険料率9.85%を使う", th.rates.health === 9.85);
t("手取り: 40歳未満は介護保険なし", th.insurance.care === 0 && th.careApplied === false);
t("手取り: 内訳の合計が社会保険料合計に一致",
  th.insurance.health + th.insurance.care + th.insurance.childcare + th.insurance.pension + th.insurance.employment === th.insurance.total);
t("手取り: 手取り＝年収−社保−所得税−住民税", th.net === th.gross - th.insurance.total - th.incomeTax - th.residentTax);
t("手取り: 年収500万の手取り率は7〜8割に収まる", th.netRate > 0.7 && th.netRate < 0.85);
t("手取り: 月額は年額の1/12", th.netMonthly === Math.floor(th.net / 12));
const th40 = L.takeHome(S, { annual: 5000000, bonus: 1000000, age: 45, prefSlug: "tokyo" });
t("手取り: 40〜64歳は介護保険料が加わる", th40.insurance.care > 0 && th40.net < th.net);
const thHi = L.takeHome(S, { annual: 20000000, bonus: 4000000, age: 30, prefSlug: "tokyo" });
t("手取り: 高年収でも厚生年金は標準報酬上限で頭打ち", thHi.standardPension === 650000);
t("手取り: 高年収ほど手取り率が下がる", thHi.netRate < th.netRate);
t("手取り: 都道府県で健康保険料が変わる", L.takeHome(S, { annual: 5000000, age: 30, prefSlug: "saga" }).insurance.health > L.takeHome(S, { annual: 5000000, age: 30, prefSlug: "okinawa" }).insurance.health);
t("手取り: 扶養が増えると税が下がる", L.takeHome(S, { annual: 5000000, age: 30, dependents: 2 }).incomeTax < th.incomeTax);
t("手取り: 年収0でも安全に動く", L.takeHome(S, { annual: 0, age: 30 }).net === 0);
t("手取り: 前提条件が明示される", th.assumptions.length >= 5);

/* 有給休暇 */
t("有給: 6か月で10日", L.paidLeave(S, { months: 6, weekDays: 5, weekHours: 40 }).current === 10);
t("有給: 6か月未満は0日", L.paidLeave(S, { months: 3, weekDays: 5, weekHours: 40 }).current === 0);
t("有給: 6年6か月以上は20日で頭打ち", L.paidLeave(S, { months: 200, weekDays: 5, weekHours: 40 }).current === 20);
t("有給: 週3日パートは比例付与", L.paidLeave(S, { months: 6, weekDays: 3, weekHours: 20 }).current === 5);
t("有給: 週30時間以上なら週4日でも通常付与", L.paidLeave(S, { months: 6, weekDays: 4, weekHours: 32 }).fullTime === true);
/* 比例付与表が労基則第24条の3の算式（通常の日数×週所定日数/5.2の切捨て）と一致することを全セルで確認 */
for (const p of S.paidLeave.proportional) {
  for (let i = 0; i < S.paidLeave.fullTime.length; i++) {
    t(`有給: 週${p.days}日 ${S.paidLeave.monthsLabels[i]} が算式と一致`,
      p.grant[i] === Math.floor(S.paidLeave.fullTime[i] * p.days / S.paidLeave.proportionalDivisor));
  }
}
t("有給: 10日以上で年5日の取得義務", L.paidLeave(S, { months: 6, weekDays: 5, weekHours: 40 }).obligationApplies === true);
t("有給: 10日未満は取得義務の対象外", L.paidLeave(S, { months: 6, weekDays: 2, weekHours: 12 }).obligationApplies === false);

/* 残業代 */
const ot = L.overtimePay(S, { monthlySalary: 300000, annualHolidays: 120, dailyHours: 8, overtimeHours: 20, nightHours: 0, holidayHours: 0 });
t("残業: 月平均所定労働時間＝(365−休日)×8/12", Math.abs(ot.fixedMonthly - (365 - 120) * 8 / 12) < 0.1);
t("残業: 時給＝月給÷所定時間", ot.hourly === Math.round(300000 / ((365 - 120) * 8 / 12)));
t("残業: 20時間分は1.25倍", Math.abs(ot.total - ot.hourly * 1.25 * 20) < 20);
const ot60 = L.overtimePay(S, { monthlySalary: 300000, annualHolidays: 120, dailyHours: 8, overtimeHours: 80 });
t("残業: 60時間超は1.5倍で計算される", ot60.lines.some((x) => x.hours === 20 && /60時間超/.test(x.label)));
t("残業: 月45時間超で上限超過を検知", ot60.overLimit === true);
const otN = L.overtimePay(S, { monthlySalary: 300000, annualHolidays: 120, dailyHours: 8, overtimeHours: 20, nightHours: 10 });
t("残業: 深夜は加算分（25%）のみ上乗せ", Math.abs(otN.total - ot.total - otN.hourly * 0.25 * 10) < 20);
t("残業: 0時間なら0円", L.overtimePay(S, { monthlySalary: 300000, annualHolidays: 120, dailyHours: 8 }).total === 0);
t("残業: 除外賃金の注意が出る", ot.assumptions.some((x) => x.includes("通勤手当")));

/* 退職スケジュール */
const rp = L.resignationPlan(S, { lastDay: "2026-12-31", paidLeaveDays: 10, noticeDays: 30, handoverDays: 14, today: "2026-08-01" });
t("退職: 6ステップの逆算が返る", rp.steps.length === 6);
t("退職: 有給10日分だけ最終出社日が前倒し", rp.lastWorkDay === "2026-12-17");
t("退職: 日付が昇順に並ぶ", rp.steps.every((s, i) => i === 0 || s.date >= rp.steps[i - 1].date));
t("退職: 民法627条の2週間を提示", rp.civilCodeDays === 14);
t("退職: 退職後の手続きも案内", rp.afterSteps.length >= 4);
t("退職: 間に合わない日付は警告", L.resignationPlan(S, { lastDay: "2026-08-10", paidLeaveDays: 0, today: "2026-08-01" }).tooLate === true);
t("退職: 不正な日付は null", L.resignationPlan(S, { lastDay: "" }) === null);

/* 面接想定質問 */
const iq = L.interviewQuestions({ occCat: "occ_it", inexperienced: true });
t("面接: 職種と状況に応じた設問群が返る", iq.groups.length === 3 && iq.count >= 12);
t("面接: 未経験フラグが反映される", iq.flags.includes("inexperienced"));
t("面接: 逆質問の候補がある", iq.reverse.length >= 5);
t("面接: 免責と非送信の明示", /保証するものではありません/.test(iq.disclaimer) && /送信されません/.test(iq.disclaimer));
t("面接: 空入力でも定番質問は返る", L.interviewQuestions({}).groups.length === 1);

/* 年収比較 */
const REC = { label: "その他の営業職業従事者", averageSalary: 661, averageAge: 42.4, sourceName: "厚生労働省", sourceUrl: "https://example.invalid/", period: "令和7年（2025年）調査" };
const sc = L.salaryCompare(REC, 450);
t("年収比較: 差と比率を返す", sc.diff === -211 && sc.percent === 68.1);
t("年収比較: 平均を下回る帯を判定", sc.band === "low");
t("年収比較: 平均並みを判定", L.salaryCompare(REC, 660).band === "mid");
t("年収比較: 統計の限界を明示", /個人の適正年収を示すものではありません/.test(sc.disclaimer));
t("年収比較: データなしは null", L.salaryCompare({ averageSalary: null }, 500) === null);
t("年収比較: 未入力は null", L.salaryCompare(REC, 0) === null);

/* データ未投入時の安全動作（推測値を出さない） */
t("法定値なし: 手取りは null", L.takeHome(null, { annual: 5000000 }) === null);
t("法定値なし: 失業給付は null", L.unemploymentBenefit(null, {}) === null);
t("法定値なし: 有給は null", L.paidLeave(null, {}) === null);

/* 出典が全ての法定値に付いている（ファクトポリシー） */
for (const k of ["unemployment", "paidLeave", "overtime", "resignation", "residentTax"]) {
  t(`出典: ${k} に出典名とURLがある`, !!S[k].source && /^https:\/\//.test(S[k].sourceUrl));
}
for (const k of ["pension", "health", "care", "childcare", "employment", "standardRemuneration"]) {
  t(`出典: 保険料率 ${k} に出典名とURLがある`, !!S.insurance[k].source && /^https:\/\//.test(S.insurance[k].sourceUrl));
}
for (const k of ["salaryDeduction", "basicDeduction", "rates", "reconstruction"]) {
  t(`出典: 所得税 ${k} に出典名とURLがある`, !!S.incomeTax[k].source && /^https:\/\//.test(S.incomeTax[k].sourceUrl));
}
t("出典: 健康保険料率は47都道府県すべてにある", Object.keys(S.insurance.health.byPref).length === 47);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
