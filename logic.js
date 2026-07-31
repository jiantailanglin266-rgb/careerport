/* CAREERPORT ルールベースエンジン（診断・書類添削・チャット相談）
   - クライアント完結の純関数。入力テキストは一切外部送信しない。
   - 断定・保証をしない：出力文言は常に「参考情報」のトーンを守ること。
   - 将来 AI API に差し替える場合もこの関数境界（入力/出力の形）を維持する。
   - 変更時は tools/test-logic.mjs を実行して green を確認すること。 */
var CP_LOGIC = (function () {
  "use strict";

  /* ============ AIキャリア診断（ルールベース） ============ */
  var TYPES = {
    income:    { name: "航路開拓タイプ", desc: "収入・待遇の向上を推進力にできるタイプです。市場価値の把握と、成果が評価に反映される環境選びが活動の軸になります。" },
    stability: { name: "安定航行タイプ", desc: "長く安心して働ける環境を重視するタイプです。事業の安定性・制度の運用実態・定着率などの確認が活動の軸になります。" },
    growth:    { name: "追い風成長タイプ", desc: "成長機会・挑戦できる環境を重視するタイプです。裁量の大きさ・学べる環境・変化のスピードが職場選びの軸になります。" },
    balance:   { name: "バランス操舵タイプ", desc: "仕事と生活の両立を重視するタイプです。働き方の柔軟性（休日・残業・リモート）の実態確認が活動の軸になります。" },
    expertise: { name: "専門深化タイプ", desc: "専門性を磨き続けることを重視するタイプです。スキルが蓄積する仕事内容かどうかが職場選びの軸になります。" }
  };
  var DIR_NOTE = {
    manage:     "マネジメント志向があるため、役職・組織規模・裁量が広がる求人が候補になります。",
    specialist: "専門職志向があるため、スキルの深掘りができる環境・評価制度を持つ企業が候補になります。",
    unsure:     "進む方向はこれから決める段階です。まず幅広く情報を集め、比較の中で軸を固めていく進め方が向いています。"
  };
  var STRENGTH_DEF = {
    communicate: { label: "対話・傾聴力", occCats: ["occ_business", "occ_service"] },
    analyze:     { label: "分析・論理的思考", occCats: ["occ_it", "occ_office"] },
    create:      { label: "創造・企画力", occCats: ["occ_it", "occ_business"] },
    support:     { label: "支援・ホスピタリティ", occCats: ["occ_medical", "occ_office"] },
    organize:    { label: "管理・段取り力", occCats: ["occ_technical", "occ_office"] },
    drive:       { label: "推進・巻き込み力", occCats: ["occ_business", "occ_professional"] }
  };
  var CAUTIONS = {
    income:    "年収だけで選ぶと入社後のミスマッチにつながることがあります。仕事内容・評価制度もあわせて確認しましょう。",
    stability: "「安定」の定義は企業により異なります。業界の将来性と自分のスキルの汎用性も、長期的な安定の材料になります。",
    growth:    "成長環境は負荷も高くなりがちです。自分が耐えられる変化のスピードかどうか、面接で具体的に確認しましょう。",
    balance:   "制度の有無だけでなく「実際に使われているか」の確認が重要です。取得実績や平均残業時間を質問しましょう。",
    expertise: "専門特化はキャリアの強みになる一方、市場の変化への備えとして隣接スキルの学習も有効です。"
  };

  function diagnose(ans) {
    ans = ans || {};
    var pr = TYPES[ans.priority] ? ans.priority : "balance";
    var dir = DIR_NOTE[ans.direction] ? ans.direction : "unsure";
    var strengths = (ans.strengths || []).filter(function (s) { return STRENGTH_DEF[s]; }).slice(0, 3);

    // 相性職種カテゴリ: 強み由来 + 現職カテゴリ（同職種キャリアアップの場合は現職優先）
    var occCats = [];
    if (ans.change === "same" && ans.occCat) occCats.push(ans.occCat);
    strengths.forEach(function (s) {
      STRENGTH_DEF[s].occCats.forEach(function (c) { if (occCats.indexOf(c) < 0) occCats.push(c); });
    });
    if (!occCats.length) occCats = ["occ_business", "occ_office"];

    // サービス出し分け用フラグ（gate 突合に使う）
    var flags = [];
    if (ans.age === "20s") flags.push("second-career");
    if (ans.change === "newjob") flags.push("inexperienced");
    if (ans.salary === "600-800" || ans.salary === "800-") flags.push("high-class");
    if (ans.direction === "manage") flags.push("manager");
    var serviceKinds = ["agent"];
    if (flags.indexOf("high-class") >= 0 || ans.direction === "manage") serviceKinds.push("scout");
    if (ans.change === "newjob") serviceKinds.push("school");

    var actions = [
      "キャリアの棚卸し：経験・スキル・数字で言える成果を書き出す",
      "職務経歴書のたたき台を作る（AI書類添削でセルフチェックできます）",
      ans.change === "newjob"
        ? "興味のある職種のページを読み、未経験転職の難易度と準備を確認する"
        : "同職種の求人を10件読み、求められる経験と相場観をつかむ",
      "転職サービスに登録し、比較しながら自分に合う支援を選ぶ"
    ];

    return {
      typeKey: pr,
      typeName: TYPES[pr].name,
      typeDesc: TYPES[pr].desc,
      dirNote: DIR_NOTE[dir],
      strengths: strengths.map(function (s) { return STRENGTH_DEF[s].label; }),
      caution: CAUTIONS[pr],
      occCats: occCats.slice(0, 4),
      serviceKinds: serviceKinds,
      flags: flags,
      actions: actions,
      disclaimer: "この診断は入力内容にもとづく参考情報であり、適職を断定したり、転職の成功や年収の上昇を保証するものではありません。"
    };
  }

  /* ============ AI書類添削（ルールベース） ============
     方針: 指摘のみを行い、本文の書き換え・実績の追加提案はしない（捏造防止）。 */
  var DOC_DEF = {
    resume:          { label: "履歴書（志望動機欄など）", min: 100, max: 400 },
    "career-history":{ label: "職務経歴書",             min: 400, max: 2400 },
    motivation:      { label: "志望動機",               min: 150, max: 500 },
    "self-promotion":{ label: "自己PR",                 min: 200, max: 600 }
  };

  function review(docType, text, opts) {
    opts = opts || {};
    var def = DOC_DEF[docType] || DOC_DEF.motivation;
    text = String(text || "").trim();
    var good = [], improve = [], notes = [];
    var score = 100;
    if (!text) {
      return { score: 0, grade: "-", docLabel: def.label, good: [], notes: [],
        improve: ["本文が入力されていません。まず一度書き切ってから添削にかけるのがおすすめです。"],
        disclaimer: disclaimerText() };
    }
    var len = text.length;

    // 1) 分量
    if (len < def.min) { score -= 15; improve.push("分量が少なめです（現在" + len + "字）。" + def.label + "は" + def.min + "〜" + def.max + "字程度が読みやすい目安とされます。具体例を1つ足すと厚みが出ます。"); }
    else if (len > def.max) { score -= 10; improve.push("分量が多めです（現在" + len + "字）。" + def.max + "字程度までに絞ると、要点が伝わりやすくなります。"); }
    else { good.push("分量は適切な範囲です（" + len + "字）。"); }

    // 2) 成果の数値化
    if (/[0-9０-９]/.test(text)) { good.push("数字が使われています。規模・期間・変化を数字で示すのは説得力につながります。"); }
    else { score -= 15; improve.push("数字が見当たりません。「◯年」「◯件」「◯%」など、規模や成果を数字で示せる箇所がないか探してみてください。"); }

    // 3) 断定・誇大表現
    var kaidan = text.match(/絶対|必ず|100[%％]|確実に|誰にも負けない/g);
    if (kaidan) { score -= 10; improve.push("断定的な表現（" + uniq(kaidan).join("・") + "）があります。根拠を示しにくい断定は、事実ベースの表現に置き換えるのが安全です。"); }

    // 4) ネガティブ表現
    var neg = text.match(/嫌い|嫌だ|不満|最悪|ブラック|辞めたい|うんざり/g);
    if (neg) { score -= 10; improve.push("ネガティブな表現（" + uniq(neg).join("・") + "）があります。不満そのものではなく「実現したいこと」への言い換えを検討してください。"); }

    // 5) 誤字の典型パターン
    var typo = text.match(/のの|をを|にに|がが|でで|しし|です。です|ます。ます/g);
    if (typo) { score -= 10; improve.push("重複の可能性がある箇所（" + uniq(typo).join("・") + "）があります。誤字でないか確認してください。"); }

    // 6) 一文の長さ
    var sentences = text.split(/[。\n]/).filter(function (s) { return s.trim().length > 0; });
    var longOnes = sentences.filter(function (s) { return s.length > 90; });
    if (longOnes.length) { score -= 8; improve.push("90字を超える長い文が" + longOnes.length + "つあります。一文一義（1文に情報1つ）に分けると読みやすくなります。"); }
    else if (sentences.length >= 3) { good.push("一文の長さが適切で、読みやすい文章です。"); }

    // 7) 結論ファースト（先頭に主張があるか）
    var head = text.slice(0, 60);
    if (/強み|志望|私は|考えて|得意/.test(head)) { good.push("冒頭から主旨に入れています。結論ファーストの構成は読み手に親切です。"); }
    else { notes.push("冒頭の60字に主旨（強み・志望理由など）が見えると、より読みやすくなります。"); }

    // 8) 職種キーワード（呼び出し側から渡された場合のみ）
    if (opts.keywords && opts.keywords.length) {
      var hit = opts.keywords.filter(function (k) { return text.indexOf(k) >= 0; });
      if (hit.length) { good.push("応募職種に関連する言葉（" + hit.slice(0, 3).join("・") + "）が含まれています。"); }
      else { notes.push("応募職種で重視されやすい要素（例：" + opts.keywords.slice(0, 3).join("・") + "）への言及があると、職種との接続が明確になります。"); }
    }

    // 9) 書類別の観点
    if (docType === "career-history" && !/職務要約|要約|概要/.test(text)) {
      notes.push("冒頭に3〜4行の「職務要約」を置く構成が一般的です。全体像を先に示すと読みやすくなります。");
    }
    if (docType === "self-promotion") {
      notes.push("強みは1つに絞り「結論 → 根拠エピソード → 応募先での活かし方」の順に並んでいるか確認してください。");
    }
    if (docType === "motivation") {
      notes.push("「転職理由 → なぜこの会社か → 貢献できること」の3点がそろっているか確認してください。");
    }

    score = Math.max(0, Math.min(100, score));
    var grade = score >= 85 ? "A" : score >= 70 ? "B" : score >= 50 ? "C" : "D";
    return { score: score, grade: grade, docLabel: def.label, good: good, improve: improve, notes: notes,
      disclaimer: disclaimerText() };
  }
  function disclaimerText() {
    return "この添削はルールにもとづく機械的なセルフチェックであり、応募先での評価や採用を保証するものではありません。経験や実績を事実と異なる形に書き換えることは推奨しません。入力内容は外部に送信されません。";
  }
  function uniq(a) { var o = []; a.forEach(function (x) { if (o.indexOf(x) < 0) o.push(x); }); return o; }

  /* ============ AIチャット相談（ルールベース） ============ */
  var INTENTS = [
    { re: /退職|辞め|引き止め|有給/, reply: "退職は「直属の上司に・結論と時期をセットで」伝えるのが基本です。就業規則の退職申し出期限（1ヶ月前が多い）を先に確認しましょう。詳しい手順は記事にまとめています。", links: [{ label: "退職の切り出し方", go: { name: "article", slug: "taishoku-kirikata" } }, { label: "退職届の書き方", go: { name: "article", slug: "taishoku-todoke" } }] },
    { re: /職務経歴書/, reply: "職務経歴書は「職務要約 → 職務経歴 → スキル → 自己PR」の4部構成が基本です。実績は数字で示すのがポイントです。書けたらAI書類添削でセルフチェックできます。", links: [{ label: "職務経歴書の書き方", go: { name: "article", slug: "shokumukeirekisho-kakikata" } }, { label: "AI書類添削を使う", go: { name: "tool-review", slug: "career-history-review" } }] },
    { re: /履歴書/, reply: "履歴書は正確さと読みやすさが第一です。学歴・職歴の書き方ルールとよくあるミスを記事にまとめています。", links: [{ label: "履歴書の書き方", go: { name: "article", slug: "rirekisho-kakikata" } }] },
    { re: /志望動機/, reply: "志望動機は「転職理由 → なぜこの会社か → 貢献できること」の3段構成で組み立てます。例文の丸写しは避け、自分の経験で埋めるのがポイントです。", links: [{ label: "志望動機の作り方", go: { name: "article", slug: "shibou-douki" } }, { label: "志望動機を添削する", go: { name: "tool-review", slug: "motivation-review" } }] },
    { re: /自己PR|自己アピール|強み/, reply: "自己PRは強みを1つに絞り「結論 → 根拠 → 活かし方」の順で伝えるのが効果的です。強みの整理にはAIキャリア診断も使えます。", links: [{ label: "自己PRの作り方", go: { name: "article", slug: "jiko-pr" } }, { label: "AIキャリア診断", go: { name: "tool-diagnosis" } }] },
    { re: /面接|逆質問/, reply: "面接対策の8割は定番質問（転職理由・志望動機・実績・強み弱み)への準備です。逆質問は「入社後の活躍を前提にした質問」が好印象とされます。", links: [{ label: "面接対策の基本", go: { name: "article", slug: "mensetsu-taisaku" } }, { label: "退職理由の答え方", go: { name: "article", slug: "mensetsu-taishokuriyu" } }] },
    { re: /年収|給料|給与|お金/, reply: "年収交渉のベストタイミングは内定後の条件面談です。まず現年収の正確な把握と相場観づくりから始めましょう。※当サイトは年収の上昇を保証するものではありません。", links: [{ label: "年収交渉の方法", go: { name: "article", slug: "nenshu-koushou" } }, { label: "年収データベース", go: { name: "salary" } }] },
    { re: /内定|辞退/, reply: "内定辞退は「決めたらすぐ・電話で・理由は簡潔に」が基本マナーです。辞退は正当な権利なので、誠実に伝えれば問題ありません。", links: [{ label: "内定辞退の伝え方", go: { name: "article", slug: "naitei-jitai" } }] },
    { re: /失業|ハローワーク|雇用保険/, reply: "失業保険（基本手当）の手続きはハローワークで行います。離職理由により給付開始時期などが変わります。概要を記事にまとめていますが、正確な情報は必ずハローワークでご確認ください。", links: [{ label: "失業保険の基本", go: { name: "article", slug: "shitsugyou-hoken" } }] },
    { re: /未経験|キャリアチェンジ|職種.*変え/, reply: "未経験転職の鍵は「ポータブルスキルの言語化」と「準備の実績づくり」の2つです。職種ごとの未経験転職の目安は各職種ページに記載しています。", links: [{ label: "未経験転職の考え方", go: { name: "article", slug: "mikeiken-tenshoku" } }, { label: "職種から探す", go: { name: "occupations" } }] },
    { re: /エージェント|スカウト|サービス.*(選|比較|おすすめ)/, reply: "エージェントは「総合型1社＋自分の領域の特化型1社」の併用が定石です。仕組みと選び方を記事に、タイプ別の比較を比較ページにまとめています。", links: [{ label: "エージェントの選び方", go: { name: "article", slug: "tenshoku-agent-erabikata" } }, { label: "サービス比較を見る", go: { name: "services" } }] },
    { re: /リスキリング|学び直し|勉強|スクール|資格/, reply: "リスキリングは「目指す仕事から逆算して学ぶ内容を決める」のが原則です。求人票10件からスキル要件を書き出す方法が実践的です。", links: [{ label: "リスキリングの始め方", go: { name: "article", slug: "risukiringu" } }, { label: "スクールを比較する", go: { name: "learning" } }] },
    { re: /診断|適職|向いて/, reply: "AIキャリア診断で、重視する価値観と強みからキャリアの方向性を整理できます。約2分・無料・入力内容は外部送信されません。※適職を断定するものではなく、考えを整理するためのツールです。", links: [{ label: "AIキャリア診断を始める", go: { name: "tool-diagnosis" } }] },
    { re: /始め方|何から|初めて|はじめて/, reply: "転職活動は「棚卸し → 軸決め → 書類準備」の順で始めるのがおすすめです。最初の2週間でやることを記事にまとめています。", links: [{ label: "転職活動の始め方", go: { name: "article", slug: "tenshoku-hajimekata" } }] }
  ];
  var CHAT_FALLBACK = {
    reply: "ご質問ありがとうございます。私は転職活動の一般的な進め方（退職・書類・面接・年収・サービスの選び方など）についてご案内できるルールベースの相談窓口です。キーワード（例：「職務経歴書」「面接」「退職」）を含めて質問いただくと、関連する情報をご案内できます。",
    links: [{ label: "転職ノウハウ記事一覧", go: { name: "articles" } }, { label: "AIキャリア診断", go: { name: "tool-diagnosis" } }]
  };
  var CHAT_REFUSAL = {
    re: /経歴.*(詐称|盛る|嘘)|嘘.*(経歴|書)|バックレ|ばっくれ|無断欠勤/,
    reply: "申し訳ありません。経歴の詐称や無断での退職など、ご自身の不利益や法的リスクにつながる方法はご案内できません。代わりに、事実を魅力的に伝える書き方や、円満な退職の手順をご案内します。",
    links: [{ label: "職務経歴書の書き方", go: { name: "article", slug: "shokumukeirekisho-kakikata" } }, { label: "退職の切り出し方", go: { name: "article", slug: "taishoku-kirikata" } }]
  };

  function chat(text) {
    text = String(text || "");
    if (CHAT_REFUSAL.re.test(text)) return { reply: CHAT_REFUSAL.reply, links: CHAT_REFUSAL.links };
    for (var i = 0; i < INTENTS.length; i++) {
      if (INTENTS[i].re.test(text)) return { reply: INTENTS[i].reply, links: INTENTS[i].links };
    }
    return CHAT_FALLBACK;
  }


/* ============ AIキャリアエージェント（対話型・ルールベース） ============
   転職エージェントの初回面談を模した対話で状況を聞き取り、
   サイトが持つ実データ（賃金構造基本統計調査・477職種の解説）を根拠に助言する。

   設計:
   - スロットフィリング方式。1問1答で埋め、埋まるたびに実データで即座に返す
   - 選択肢（チップ）でも自由入力でも進められる。自由入力は意図解釈にフォールバック
   - 断定・保証はしない。統計は「参考値」であること、平均年齢の影響を必ず添える
   - 外部送信なし。結果は利用者が選んだ場合のみ端末内に保存

   ホスト側（index.html）から渡すもの:
     ctx = { salaryFor(slug) -> {label,averageSalary,averageAge,period}|null,
             occupations: [{slug,name,categoryId,summary,inexperienced,featured}],
             hasArticle(slug) -> bool }
*/
var AGENT_SLOTS = ["intent", "occupation", "age", "salary", "priority", "timeline"];

var AGENT_Q = {
  intent: {
    q: "はじめまして。CAREERPORTのキャリアエージェントです。まず、いま一番気になっていることを教えてください。",
    hint: "選んでも、自由に書いてもかまいません。",
    opts: [
      ["undecided", "転職するか迷っている"],
      ["income", "年収を上げたい"],
      ["change", "未経験の仕事に挑戦したい"],
      ["quit", "今の職場を辞めたい"],
      ["howto", "進め方を知りたい"]
    ]
  },
  occupation: {
    q: "ありがとうございます。いま（直近）のお仕事に近いものはどれですか？",
    hint: "一覧にない場合は職種名を入力してください。",
    opts: null // ホスト側が主要職種から生成
  },
  age: {
    q: "年代を教えてください。求人の傾向や評価のされ方が変わります。",
    opts: [["20s", "20代"], ["30s", "30代"], ["40s", "40代"], ["50s", "50代以上"]]
  },
  salary: {
    q: "現在の年収帯はどのあたりでしょうか。統計と比べてお伝えします。",
    hint: "だいたいで構いません。答えたくない場合は「スキップ」と入力してください。",
    opts: [["-300", "300万円未満"], ["300-400", "300〜400万円"], ["400-500", "400〜500万円"],
           ["500-600", "500〜600万円"], ["600-800", "600〜800万円"], ["800-", "800万円以上"]]
  },
  priority: {
    q: "次の仕事で最も大事にしたいことは何ですか。",
    opts: [["income", "収入・待遇"], ["stability", "安定して長く働ける"], ["growth", "成長・挑戦"],
           ["balance", "生活との両立"], ["expertise", "専門性を高める"]]
  },
  timeline: {
    q: "最後に、転職の希望時期を教えてください。",
    opts: [["now", "3か月以内"], ["half", "半年以内"], ["year", "1年以内"], ["undecided", "まだ決めていない"]]
  }
};

var SALARY_MID = { "-300": 250, "300-400": 350, "400-500": 450, "500-600": 550, "600-800": 700, "800-": 900 };
var INTENT_LABEL = {
  undecided: "転職するか迷っている", income: "年収を上げたい",
  change: "未経験の仕事に挑戦したい", quit: "今の職場を辞めたい", howto: "進め方を知りたい"
};

function agentInit() {
  return { slots: {}, log: [], done: false };
}
function nextSlot(st) {
  for (var i = 0; i < AGENT_SLOTS.length; i++) if (st.slots[AGENT_SLOTS[i]] == null) return AGENT_SLOTS[i];
  return null;
}

/* 自由入力を現在のスロットの値に解釈する。解釈できなければ null */
function parseFree(slot, text, ctx) {
  var t = String(text || "").trim();
  if (!t) return null;
  if (/スキップ|skip|答えたくない|わからない|不明/.test(t)) return "__skip__";
  var o = AGENT_Q[slot];
  if (o && o.opts) {
    for (var i = 0; i < o.opts.length; i++) {
      if (t.indexOf(o.opts[i][1]) >= 0 || o.opts[i][1].indexOf(t) >= 0) return o.opts[i][0];
    }
  }
  if (slot === "age") {
    var band = function (y) { y = Math.floor(y / 10) * 10; return (y < 20 ? 20 : y > 50 ? 50 : y) + "s"; };
    var md = t.match(/(\d{2})\s*代/);            // 「30代」
    if (md) return band(Number(md[1]));
    var my = t.match(/(\d{2})\s*(?:歳|才)/);      // 「35歳」
    if (my) return band(Number(my[1]));
    var mn = t.match(/^\D*(\d{2})\D*$/);          // 「35」だけ
    if (mn) return band(Number(mn[1]));
  }
  if (slot === "salary") {
    var n = t.match(/(\d{3,4})\s*万/);
    if (n) { var v = Number(n[1]);
      return v < 300 ? "-300" : v < 400 ? "300-400" : v < 500 ? "400-500" : v < 600 ? "500-600" : v < 800 ? "600-800" : "800-"; }
  }
  if (slot === "occupation" && ctx && ctx.occupations) {
    var hit = ctx.occupations.filter(function (o) { return o.name.indexOf(t) >= 0 || t.indexOf(o.name) >= 0; })
      .sort(function (a, b) { return (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || a.name.length - b.name.length; })[0];
    if (hit) return hit.slug;
  }
  return null;
}

/* スロットが埋まった直後の、実データにもとづくエージェントの反応 */
function reactTo(slot, value, st, ctx) {
  if (value === "__skip__") return "承知しました。差し支えない範囲で進めます。";
  if (slot === "intent") {
    return {
      undecided: "迷っている段階でご相談いただくのが一番いいタイミングです。情報を整理すれば、動かない選択も納得して選べます。",
      income: "年収は「交渉で上げる」より「評価される場所を選ぶ」ほうが動きます。まず現在地を統計で確認しましょう。",
      change: "未経験転職は、年齢よりも「これまでの経験をどう translate するか」で決まります。順に整理していきます。",
      quit: "まずは状況の整理からで大丈夫です。辞め方より先に、次の方向が決まると気持ちが軽くなります。",
      howto: "進め方は型があります。棚卸し→軸決め→書類→応募の順です。あなたの状況に合わせて具体化します。"
    }[value] || "承知しました。";
  }
  if (slot === "occupation") {
    var occ = ctx.occupationBySlug(value);
    if (!occ) return "承知しました。";
    var sr = ctx.salaryFor(value);
    var s = "「" + occ.name + "」ですね。";
    if (sr) {
      s += "賃金構造基本統計調査（" + sr.period + "）では、統計区分「" + sr.label + "」の平均年収は約"
         + sr.averageSalary + "万円（平均年齢" + sr.averageAge + "歳）です。";
      st.slots._benchmark = { slug: value, label: sr.label, avg: sr.averageSalary, age: sr.averageAge, period: sr.period };
    } else {
      s += "この職種に対応する統計区分は当サイトでは準備中です。";
    }
    return s;
  }
  if (slot === "salary") {
    var b = st.slots._benchmark, mid = SALARY_MID[value];
    if (!b || !mid) return "ありがとうございます。";
    var diff = mid - b.avg;
    var pct = Math.round((mid / b.avg) * 100);
    if (Math.abs(diff) <= 50) {
      return "統計区分「" + b.label + "」の平均（約" + b.avg + "万円）とおおむね同水準です。ただし平均は平均年齢"
           + b.age + "歳の値なので、年代が離れているほど単純比較はできません。";
    }
    if (diff < 0) {
      return "統計区分「" + b.label + "」の平均（約" + b.avg + "万円）に対して、およそ" + pct
           + "%の水準です。年齢や企業規模で差が出るため断定はできませんが、"
           + "同職種で条件の良い環境に移ることで改善の余地があるかもしれません。";
    }
    return "統計区分「" + b.label + "」の平均（約" + b.avg + "万円）を上回る水準です（およそ" + pct
         + "%）。転職で年収を維持・向上させるには、実績の数値化と、評価制度の確認が重要になります。";
  }
  if (slot === "age") {
    return { "20s": "20代はポテンシャル採用の求人が多く、未経験職種への転換もしやすい時期とされます。",
             "30s": "30代は即戦力性が評価の中心です。実績の数値化が効いてきます。",
             "40s": "40代はマネジメント経験や専門性が評価軸になります。求人は絞られますが、責任あるポジションの募集もあります。",
             "50s": "50代は経験・人脈・専門性を活かす転職が中心です。情報収集の期間を長めに取るのが現実的です。" }[value] || "";
  }
  if (slot === "priority") {
    return { income: "収入軸ですね。仕事内容・評価制度もあわせて確認しないと、入社後のミスマッチにつながります。",
             stability: "安定軸ですね。企業の安定性に加えて、自分のスキルの汎用性も長期的な安定材料になります。",
             growth: "成長軸ですね。負荷も高くなりがちなので、耐えられる変化のスピードかを面接で確認しましょう。",
             balance: "両立軸ですね。制度の有無より「実際に使われているか」の確認が決め手になります。",
             expertise: "専門性軸ですね。スキルが積み上がる仕事内容かどうかで職場を選ぶとぶれません。" }[value] || "";
  }
  if (slot === "timeline") {
    return { now: "3か月以内なら、今週から書類の準備を始めるのが現実的なスケジュールです。",
             half: "半年あれば、情報収集と書類を整えたうえで、納得のいく比較ができます。",
             year: "1年の余裕があるなら、資格取得や実績づくりも選択肢に入ります。",
             undecided: "時期は決まっていなくて大丈夫です。準備だけ先に進めておくと、良い求人が出たときに動けます。" }[value] || "";
  }
  return "";
}

/* 最終カルテ */
function agentResult(st, ctx) {
  var s = st.slots, b = s._benchmark;
  var TYPE = { income: "航路開拓タイプ", stability: "安定航行タイプ", growth: "追い風成長タイプ",
               balance: "バランス操舵タイプ", expertise: "専門深化タイプ" };
  var type = TYPE[s.priority] || "バランス操舵タイプ";

  var salaryLine = null;
  if (b && s.salary && s.salary !== "__skip__" && SALARY_MID[s.salary]) {
    var mid = SALARY_MID[s.salary];
    salaryLine = { label: b.label, avg: b.avg, avgAge: b.age, period: b.period, mine: mid,
      ratio: Math.round((mid / b.avg) * 100),
      note: "統計は平均年齢" + b.age + "歳の値です。年齢・企業規模・地域で差が出るため、順位づけではなく現在地の目安としてご覧ください。" };
  }

  // 次のアクション（サイト内の実コンテンツへ）
  var actions = [];
  if (s.intent === "income" || s.priority === "income") {
    actions.push({ label: "年収交渉の進め方を読む", go: { name: "article", slug: "nenshu-koushou" } });
    actions.push({ label: "職種別の平均年収を比べる", go: { name: "salary" } });
  }
  if (s.intent === "change") {
    actions.push({ label: "未経験転職の考え方を読む", go: { name: "article", slug: "mikeiken-tenshoku" } });
    actions.push({ label: "全477職種から探す", go: { name: "occupations" } });
  }
  if (s.intent === "quit") {
    actions.push({ label: "退職の切り出し方を読む", go: { name: "article", slug: "taishoku-kirikata" } });
  }
  if (s.intent === "howto" || s.intent === "undecided") {
    actions.push({ label: "転職活動の始め方（最初の2週間）", go: { name: "article", slug: "tenshoku-hajimekata" } });
  }
  actions.push({ label: "職務経歴書をAIで添削する", go: { name: "tool-review", slug: "career-history-review" } });
  if (s.age === "20s") actions.push({ label: "20代の転職の進め方", go: { name: "career", slug: "20s" } });
  if (s.age === "40s" || s.age === "50s") actions.push({ label: "ハイクラス転職の考え方", go: { name: "career", slug: "high-class" } });

  // 相性のよい職種（現職カテゴリ＋意向）
  var occCats = [];
  var cur = s.occupation ? ctx.occupationBySlug(s.occupation) : null;
  if (cur) occCats.push(cur.categoryId);

  // サービス出し分け用フラグ
  var flags = [];
  if (s.age === "20s") flags.push("second-career");
  if (s.intent === "change") flags.push("inexperienced");
  if (s.salary === "600-800" || s.salary === "800-") flags.push("high-class");
  var kinds = ["agent"];
  if (flags.indexOf("high-class") >= 0) kinds.push("scout");
  if (s.intent === "change") kinds.push("school");

  return {
    typeName: type,
    summary: [
      s.intent ? "ご相談内容: " + (INTENT_LABEL[s.intent] || "") : "",
      cur ? "現在の職種: " + cur.name : "",
      s.age ? "年代: " + ({ "20s": "20代", "30s": "30代", "40s": "40代", "50s": "50代以上" }[s.age] || "") : "",
      s.timeline ? "希望時期: " + ({ now: "3か月以内", half: "半年以内", year: "1年以内", undecided: "未定" }[s.timeline] || "") : ""
    ].filter(Boolean),
    salaryLine: salaryLine,
    occCats: occCats,
    serviceKinds: kinds,
    flags: flags,
    actions: actions.slice(0, 5),
    disclaimer: "この面談はご入力内容にもとづくルールベースの整理であり、適職の断定や、転職の成功・年収の上昇を保証するものではありません。統計値は出典（賃金構造基本統計調査）の公表値からの算出参考値です。入力内容が外部に送信されることはありません。"
  };
}

/* 1ターン進める。value は選択肢のキー、または自由入力文字列 */
function agentStep(st, input, ctx) {
  var slot = nextSlot(st);
  if (!slot) { st.done = true; return { done: true, result: agentResult(st, ctx) }; }

  // 自由入力が、いまの質問への答えでない「質問」なら、相談として答えて同じ質問を続ける
  var val = (input && input.__key) ? input.__key : parseFree(slot, input, ctx);
  if (val == null) {
    var ans = chat(String(input || ""));
    return { done: false, aside: ans, slot: slot, question: AGENT_Q[slot], reask: true };
  }
  st.slots[slot] = val;
  st.log.push({ slot: slot, value: val });
  var react = reactTo(slot, val, st, ctx);
  var next = nextSlot(st);
  if (!next) { st.done = true; return { done: true, react: react, result: agentResult(st, ctx) }; }
  return { done: false, react: react, slot: next, question: AGENT_Q[next] };
}

  /* ================= 無料ツール：法定計算エンジン =================
     率・金額はこのファイルに一切書かない。すべて S（DATA.statutory＝tools/data/statutory.json）
     から受け取る。改定時は JSON を差し替えるだけでよく、出典表示と計算が食い違わない。
     S が無い（未投入）ときは null を返し、UI 側は「データ準備中」を表示して計算しない。 */

  function num(v, min, max, def) {
    var n = Number(v);
    if (!isFinite(n)) n = def;
    if (min != null && n < min) n = min;
    if (max != null && n > max) n = max;
    return n;
  }
  function bracketOf(list, v) {
    for (var i = 0; i < list.length; i++) if (list[i].upTo == null || v <= list[i].upTo) return list[i];
    return list[list.length - 1];
  }

  /* ---- 給与所得控除（国税庁 No.1410） ---- */
  function salaryDeduction(S, income) {
    var b = bracketOf(S.incomeTax.salaryDeduction.brackets, income);
    var d = b.flat != null ? b.flat : Math.floor(income * b.rate + b.add);
    return Math.min(d, income); // 給与所得はマイナスにならない
  }
  /* ---- 標準報酬月額（協会けんぽ 保険料額表の等級） ---- */
  function standardMonthly(S, monthly) {
    var g = S.insurance.standardRemuneration, i = 0;
    for (var k = 0; k < g.grades.length; k++) if (monthly >= g.lowerBounds[k]) i = k;
    return g.grades[i];
  }

  /* ---- ツール1: 手取り計算 ---- */
  function takeHome(S, inp) {
    if (!S) return null;
    inp = inp || {};
    var annual = num(inp.annual, 0, 300000000, 0);
    var bonus = num(inp.bonus, 0, annual, 0);
    var bonusCount = num(inp.bonusCount, 1, 6, 2);
    var age = num(inp.age, 15, 74, 30);
    var deps = num(inp.dependents, 0, 10, 0);
    var ins = S.insurance, sr = ins.standardRemuneration;
    var pref = ins.health.byPref[inp.prefSlug] ? inp.prefSlug : "tokyo";
    var hp = ins.health.byPref[pref];
    if (annual <= 0) {
      return { gross: 0, bonus: 0, prefSlug: pref, prefName: hp.name, age: age, dependents: deps,
        standardMonthly: 0, standardPension: 0, careApplied: false,
        insurance: { health: 0, care: 0, childcare: 0, pension: 0, employment: 0, total: 0 },
        rates: { health: hp.rate, care: 0, childcare: ins.childcare.rate, pension: ins.pension.rate, employment: ins.employment.employeeRate },
        salaryIncome: 0, basicDeduction: 0, taxableIncome: 0, incomeTax: 0, residentTax: 0,
        net: 0, netMonthly: 0, netRate: 0, deductionTotal: 0,
        assumptions: ["年収を入力すると、社会保険料・所得税・住民税の内訳と手取り額を計算します。"] };
    }

    var isCare = age >= ins.care.fromAge && age <= ins.care.toAge;
    var half = ins.pension.employeeShare;
    var sm = standardMonthly(S, (annual - bonus) / 12);
    var sp = Math.min(Math.max(sm, sr.pensionMin), sr.pensionMax);
    var per = Math.floor(bonus / bonusCount / sr.bonusRoundDown) * sr.bonusRoundDown;
    var bHealth = Math.min(per * bonusCount, sr.bonusHealthAnnualCap);
    var bPension = Math.min(per, sr.bonusPensionPerTimeCap) * bonusCount;

    var health = Math.floor((sm * 12 + bHealth) * (hp.rate / 100) * half);
    var care = isCare ? Math.floor((sm * 12 + bHealth) * (ins.care.rate / 100) * half) : 0;
    var child = Math.floor((sm * 12 + bHealth) * (ins.childcare.rate / 100) * half);
    var pension = Math.floor((sp * 12 + bPension) * (ins.pension.rate / 100) * half);
    var employment = Math.floor(annual * (ins.employment.employeeRate / 100));
    var social = health + care + child + pension + employment;

    var salaryIncome = annual - salaryDeduction(S, annual);
    var basic = bracketOf(S.incomeTax.basicDeduction.brackets, salaryIncome).amount;
    var depIncome = deps * 380000, depResident = deps * 330000;
    var taxable = Math.max(0, Math.floor((salaryIncome - social - basic - depIncome) / 1000) * 1000);
    var rb = bracketOf(S.incomeTax.rates.brackets, taxable);
    var baseTax = Math.max(0, Math.floor(taxable * rb.rate - rb.deduct));
    var incomeTax = Math.floor(baseTax * (1 + S.incomeTax.reconstruction.rate));

    var rTaxable = Math.max(0, Math.floor((salaryIncome - social - S.residentTax.basicDeduction - depResident) / 1000) * 1000);
    var residentTax = rTaxable > 0 ? Math.floor(rTaxable * S.residentTax.incomeRate) + S.residentTax.perCapita : 0;

    var net = annual - social - incomeTax - residentTax;
    return {
      gross: annual, bonus: bonus, prefSlug: pref, prefName: hp.name, age: age, dependents: deps,
      standardMonthly: sm, standardPension: sp, careApplied: isCare,
      insurance: { health: health, care: care, childcare: child, pension: pension, employment: employment, total: social },
      rates: { health: hp.rate, care: isCare ? ins.care.rate : 0, childcare: ins.childcare.rate, pension: ins.pension.rate, employment: ins.employment.employeeRate },
      salaryIncome: salaryIncome, basicDeduction: basic, taxableIncome: taxable,
      incomeTax: incomeTax, residentTax: residentTax,
      net: net, netMonthly: Math.floor(net / 12), netRate: annual > 0 ? net / annual : 0,
      deductionTotal: social + incomeTax + residentTax,
      assumptions: [
        "健康保険は協会けんぽ（" + hp.name + "・" + hp.rate + "%）、厚生年金は" + ins.pension.rate + "%として、いずれも労使折半の本人負担分で計算しています。組合健保・共済にお勤めの方は率が異なります。",
        "月給と賞与を分けて標準報酬月額の等級にあてはめています。賞与は年" + bonusCount + "回に均等に支給されるものとして計算しています。",
        (isCare ? "40〜64歳のため介護保険料を含めています。" : "40歳未満のため介護保険料は含めていません（40歳から加わります）。"),
        "扶養親族は1人あたり所得税38万円・住民税33万円の控除として計算しています。19〜22歳の特定扶養親族（63万円）や配偶者控除の所得制限、特定親族特別控除は反映していません。",
        "住民税は前年の所得に対して課税されますが、ここでは同じ年収が続く前提で計算しています。均等割は" + S.residentTax.perCapita + "円、調整控除は考慮していません。",
        "生命保険料控除・住宅ローン控除・iDeCo・医療費控除などは含めていません。実際の手取りは会社の制度や控除により変わります。"
      ]
    };
  }

  /* ---- ツール2: 失業給付（基本手当）シミュレーション ---- */
  function benefitAgeBand(U, age) {
    for (var i = 0; i < U.ageBands.length; i++) {
      var b = U.ageBands[i], id = b.id;
      if (id === "u30" && age < 30) return b;
      if (id === "a30" && age >= 30 && age < 45) return b;
      if (id === "a45" && age >= 45 && age < 60) return b;
      if (id === "a60" && age >= 60 && age < 65) return b;
    }
    return null;
  }
  function dailyBenefit(U, band, w) {
    if (w < U.wageDailyMin) w = U.wageDailyMin;
    var y;
    if (w < band.w1) y = 0.8 * w;
    else if (w <= band.w2) {
      y = 0.8 * w - band.drop * ((w - band.w1) / (band.w2 - band.w1)) * w;
      if (band.alt) y = Math.min(y, 0.05 * w + band.w2 * 0.4);
    } else if (w <= band.cap) y = band.rate2 * w;
    else y = band.maxDaily;
    return Math.floor(y);
  }
  function termIndex(years) {
    if (years < 1) return 0;
    if (years < 5) return 1;
    if (years < 10) return 2;
    if (years < 20) return 3;
    return 4;
  }
  function daysRowFor(table, age) {
    var rows = table.rows;
    if (rows.length === 1) return rows[0];
    for (var i = 0; i < rows.length; i++) {
      var a = rows[i].age;
      if (a === "u30" && age < 30) return rows[i];
      if (a === "a30" && age >= 30 && age < 35) return rows[i];
      if (a === "a35" && age >= 35 && age < 45) return rows[i];
      if (a === "u45" && age < 45) return rows[i];
      if (a === "a45" && age >= 45 && age < 60) return rows[i];
      if (a === "a45" && age >= 45 && age < 65 && rows.length === 2) return rows[i];
      if (a === "a60" && age >= 60 && age < 65) return rows[i];
    }
    return rows[rows.length - 1];
  }
  function unemploymentBenefit(S, inp) {
    if (!S) return null;
    inp = inp || {};
    var U = S.unemployment;
    var age = num(inp.age, 15, 74, 30);
    var monthly = num(inp.monthlyWage, 0, 10000000, 0);
    var years = num(inp.insuredYears, 0, 50, 0);
    var reason = ({ self: 1, company: 1, difficult: 1 })[inp.reason] ? inp.reason : "self";
    var repeat = !!inp.repeat;
    var notes = [], warnings = [];

    if (age >= 65) {
      return { eligible: false, over65: true, age: age,
        message: "65歳以上で離職した場合は基本手当ではなく「高年齢求職者給付金」の対象です。被保険者であった期間が1年以上なら基本手当日額の50日分、1年未満なら30日分が一時金として支給されます。",
        sourceName: U.daysSource, sourceUrl: U.daysSourceUrl };
    }
    var band = benefitAgeBand(U, age);
    var wageDaily = Math.floor(monthly / 30);
    var daily = dailyBenefit(U, band, wageDaily);
    var table = U.days[reason === "self" ? "general" : reason === "company" ? "company" : "difficult"];
    var row = daysRowFor(table, age);
    var ti = termIndex(years);
    var days = row.d[ti];

    if (reason === "self" && years < 1) {
      warnings.push("被保険者期間が1年未満のため、自己都合退職では原則として受給資格がありません（離職前2年間に通算12か月以上の被保険者期間が必要）。倒産・解雇などの場合は離職前1年間に6か月以上で受給できます。");
    }
    if (days == null) {
      warnings.push("この年齢と被保険者期間の組み合わせは表に定めがありません。ハローワークでご確認ください。");
      days = 0;
    }
    var restrictionMonths = reason === "self" ? (repeat ? U.restriction.repeatMonths : U.restriction.selfMonths) : 0;
    if (wageDaily < U.wageDailyMin) notes.push("賃金日額が下限額（" + U.wageDailyMin + "円）を下回るため、下限額で計算しています。");
    if (wageDaily > band.cap) notes.push("賃金日額が上限額（" + band.cap + "円）を超えるため、基本手当日額は" + band.label + "の上限" + band.maxDaily + "円になります。");

    return {
      eligible: true, age: age, band: band.label, wageDaily: wageDaily, daily: daily,
      rate: wageDaily > 0 ? daily / wageDaily : 0,
      days: days, total: daily * days, reason: reason, reasonLabel: table.label,
      insuredYears: years, termLabel: U.termLabels[ti],
      waitingDays: U.waitingDays, restrictionMonths: restrictionMonths,
      firstPayMonths: restrictionMonths, notes: notes, warnings: warnings,
      restrictionNote: U.restriction.note, periodNote: U.periodNote, tableNote: table.note || "",
      asOf: U.asOf, sourceName: U.source, sourceUrl: U.sourceUrl,
      daysSource: U.daysSource, daysSourceUrl: U.daysSourceUrl,
      disclaimer: "実際の支給額・日数は、離職理由の判定や被保険者期間の計算によってハローワークが決定します。ここでの計算は目安であり、受給を保証するものではありません。"
    };
  }

  /* ---- ツール3: 年次有給休暇の付与日数 ---- */
  function paidLeave(S, inp) {
    if (!S) return null;
    inp = inp || {};
    var P = S.paidLeave;
    var months = num(inp.months, 0, 600, 0);
    var weekDays = num(inp.weekDays, 1, 7, 5);
    var weekHours = num(inp.weekHours, 0, 80, 40);
    var fullTime = weekHours >= 30 || weekDays >= 5;
    var table = P.fullTime, pattern = null;
    if (!fullTime) {
      for (var i = 0; i < P.proportional.length; i++) if (P.proportional[i].days === Math.min(4, Math.round(weekDays))) pattern = P.proportional[i];
      if (!pattern) pattern = P.proportional[P.proportional.length - 1];
      table = pattern.grant;
    }
    var idx = months < 6 ? -1 : Math.min(P.monthsLabels.length - 1, Math.floor((months - 6) / 12));
    var current = idx < 0 ? 0 : table[idx];
    var nextIdx = Math.min(P.monthsLabels.length - 1, idx + 1);
    var monthsToNext = idx < 0 ? 6 - months : (6 + (idx + 1) * 12) - months;
    if (idx >= P.monthsLabels.length - 1) monthsToNext = 12 - ((months - 6) % 12);
    return {
      fullTime: fullTime, weekDays: weekDays, weekHours: weekHours,
      months: months, stageLabel: idx < 0 ? "6か月未満（付与前）" : P.monthsLabels[idx],
      current: current, table: table, labels: P.monthsLabels,
      patternLabel: fullTime ? P.fullTimeCondition : "週" + pattern.days + "日勤務（年間" + pattern.annualFrom + "〜" + pattern.annualTo + "日）",
      next: idx < 0 ? table[0] : table[nextIdx], monthsToNext: Math.max(0, Math.ceil(monthsToNext)),
      maxCarry: current + (idx > 0 ? table[idx - 1] : 0),
      obligationApplies: current >= 10, obligationDays: P.obligationDays, expiryYears: P.expiryYears,
      notes: [
        "付与には、その期間の全労働日の" + Math.round(P.attendanceRate * 100) + "%以上に出勤していることが必要です。",
        "年10日以上付与される方には、会社が年" + P.obligationDays + "日を確実に取得させる義務があります（労働基準法第39条第7項）。",
        "有給休暇の権利は" + P.expiryYears + "年で時効消滅します。前年の未消化分は翌年に繰り越せます。",
        "退職日をもって有給休暇の権利は消滅します。退職前にまとめて取得する場合、会社は時季変更権を行使できません。"
      ],
      sourceName: P.source, sourceUrl: P.sourceUrl
    };
  }

  /* ---- ツール4: 残業代の計算 ---- */
  function overtimePay(S, inp) {
    if (!S) return null;
    inp = inp || {};
    var O = S.overtime;
    var monthly = num(inp.monthlySalary, 0, 100000000, 0);
    var holidays = num(inp.annualHolidays, 0, 200, 120);
    var dailyHours = num(inp.dailyHours, 1, 12, 8);
    var over = num(inp.overtimeHours, 0, 400, 0);
    var night = num(inp.nightHours, 0, 400, 0);
    var hol = num(inp.holidayHours, 0, 400, 0);
    var fixedMonthly = (365 - holidays) * dailyHours / 12;
    if (fixedMonthly <= 0) return null;
    var hourly = monthly / fixedMonthly;
    var r = {};
    for (var i = 0; i < O.rates.length; i++) r[O.rates[i].id] = O.rates[i].rate;
    var base = Math.min(over, 60), extra = Math.max(0, over - 60);
    night = Math.min(night, over + hol);
    var pBase = hourly * (1 + r.over) * base;
    var pExtra = hourly * (1 + r.over60) * extra;
    var pNight = hourly * r.night * night;
    var pHol = hourly * (1 + r.holiday) * hol;
    var total = pBase + pExtra + pNight + pHol;
    return {
      hourly: Math.round(hourly), fixedMonthly: Math.round(fixedMonthly * 10) / 10,
      lines: [
        { label: "時間外労働（60時間まで・割増" + Math.round(r.over * 100) + "%）", hours: base, amount: Math.floor(pBase) },
        { label: "時間外労働（60時間超・割増" + Math.round(r.over60 * 100) + "%）", hours: extra, amount: Math.floor(pExtra) },
        { label: "深夜割増の加算分（割増" + Math.round(r.night * 100) + "%）", hours: night, amount: Math.floor(pNight) },
        { label: "法定休日労働（割増" + Math.round(r.holiday * 100) + "%）", hours: hol, amount: Math.floor(pHol) }
      ].filter(function (x) { return x.hours > 0; }),
      total: Math.floor(total), overLimit: over > 45,
      note: O.note, upperLimit: O.upperLimit, sourceName: O.source, sourceUrl: O.sourceUrl,
      assumptions: [
        "1時間あたりの賃金は「月給 ÷ 月平均所定労働時間（" + Math.round(fixedMonthly * 10) / 10 + "時間）」で計算しています。",
        "月給には、家族手当・通勤手当・別居手当・子女教育手当・住宅手当・臨時の賃金・賞与を含めずに入力してください（労働基準法第37条第5項の除外賃金）。",
        "管理監督者・裁量労働制・変形労働時間制・固定残業代（みなし残業）がある場合は計算方法が異なります。"
      ]
    };
  }

  /* ---- ツール5: 退職・転職スケジュールの逆算 ---- */
  function ymd(d) {
    var m = String(d.getMonth() + 1), day = String(d.getDate());
    return d.getFullYear() + "-" + (m.length < 2 ? "0" + m : m) + "-" + (day.length < 2 ? "0" + day : day);
  }
  function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function backBusinessDays(d, n) {
    var x = new Date(d.getTime()), left = n;
    while (left > 0) { x = addDays(x, -1); var w = x.getDay(); if (w !== 0 && w !== 6) left--; }
    return x;
  }
  function resignationPlan(S, inp) {
    if (!S) return null;
    inp = inp || {};
    var R = S.resignation;
    var last = new Date(String(inp.lastDay || "") + "T00:00:00");
    if (isNaN(last.getTime())) return null;
    var leave = num(inp.paidLeaveDays, 0, 60, 0);
    var notice = num(inp.noticeDays, 14, 180, 30);
    var handover = num(inp.handoverDays, 0, 90, 14);
    var today = inp.today ? new Date(String(inp.today) + "T00:00:00") : new Date();

    var lastWork = leave > 0 ? backBusinessDays(last, leave) : new Date(last.getTime());
    var handoverStart = backBusinessDays(lastWork, handover);
    /* 「伝える → 引き継ぎ開始」の順が崩れないよう、引き継ぎ開始の1週間前を上限とし、
       就業規則の申出期限（退職日の notice 日前）のうち早い方を採用する。 */
    var tellBy = addDays(handoverStart, -7);
    var ruleLimit = addDays(last, -notice);
    if (ruleLimit < tellBy) tellBy = ruleLimit;
    var legalMin = addDays(today, R.civilCodeDays);
    var offerBy = addDays(tellBy, -30);
    var startBy = addDays(offerBy, -90);

    var steps = [
      { date: ymd(startBy), label: "転職活動の開始",     note: "書類作成・応募から内定まで3か月前後を見込んだ逆算です。在職中の活動は面接日程の調整に時間がかかります。" },
      { date: ymd(offerBy), label: "内定・条件面の合意", note: "内定から退職交渉まで1か月ほどの余裕をとっています。入社日は退職日の確定後に最終合意するのが安全です。" },
      { date: ymd(tellBy),  label: "退職の意思を伝える", note: "就業規則で「" + notice + "日前まで」と想定した期限です。まず直属の上司に口頭で伝え、そのあと退職届を出す順序が一般的です。" },
      { date: ymd(handoverStart), label: "引き継ぎの開始", note: "引き継ぎ資料の作成・後任への説明に" + handover + "日を確保しています。" },
      { date: ymd(lastWork), label: "最終出社日",       note: leave > 0 ? "この翌営業日から有給休暇" + leave + "日を消化する想定です（土日を除いた日数で計算）。" : "有給休暇の消化を入力すると、最終出社日が前倒しされます。" },
      { date: ymd(last),    label: "退職日",             note: "退職日をもって有給休暇の権利は消滅します。残日数は退職日までに消化するか、会社の制度によっては買い上げとなる場合があります。" }
    ];
    var afterSteps = [
      { within: "退職日の翌日から14日以内", label: "健康保険・年金の切り替え", note: "国民健康保険・国民年金への切り替え、または健康保険の任意継続（こちらは資格喪失日から20日以内）。次の会社にすぐ入社する場合は入社先で手続きします。" },
      { within: "離職票が届き次第", label: "ハローワークで求職の申込み", note: "失業給付を受ける場合は、離職票を持ってハローワークで手続きします。待期7日と給付制限の起算はこの手続きの後です。" },
      { within: "退職時", label: "住民税の徴収方法の確認", note: "退職月によって、一括徴収・普通徴収・転職先での継続徴収のいずれになるかが変わります。給与担当に確認しておくと安心です。" },
      { within: "翌年の確定申告期間", label: "年末調整・確定申告", note: "年内に転職して新しい勤務先で年末調整を受ける場合は前職の源泉徴収票が必要です。年をまたぐ場合は自分で確定申告します。" }
    ];
    return {
      lastDay: ymd(last), lastWorkDay: ymd(lastWork), tellBy: ymd(tellBy),
      legalMinimum: ymd(legalMin), paidLeaveDays: leave, noticeDays: notice,
      tooLate: tellBy < today, steps: steps, afterSteps: afterSteps,
      civilCodeDays: R.civilCodeDays, note: R.note, sourceName: R.source, sourceUrl: R.sourceUrl
    };
  }

  /* ---- ツール6: 面接想定質問の生成（ルールベース） ---- */
  var IV_COMMON = [
    { q: "自己紹介を1分でお願いします。", h: "職務要約と応募職種との接点を先に。細かい経歴の羅列は避け、続きを聞きたくさせる構成に。" },
    { q: "転職を考えたきっかけを教えてください。", h: "現職への不満ではなく「これをやりたい」に言い換える。事実は変えず、視点を未来に置く。" },
    { q: "なぜ当社なのですか。", h: "他社にも当てはまる理由（規模・待遇）だけだと弱い。事業内容・職務内容と自分の経験の接点を1つ具体的に。" },
    { q: "あなたの強みは何ですか。", h: "結論→根拠となる実績（数字）→入社後どう活かすか、の3段で。" },
    { q: "これまでの仕事で一番の成果は何ですか。", h: "状況・課題・自分の行動・結果の順。チームの成果と自分の担当範囲を分けて話す。" },
    { q: "失敗した経験と、そこから学んだことは。", h: "取り繕わず、原因の分析と再発防止の行動までセットで。" },
    { q: "5年後にどうなっていたいですか。", h: "応募ポジションの延長線上に置く。壮大な話より、次の1〜2歩を具体的に。" },
    { q: "他社の選考状況を教えてください。", h: "軸が一貫していることが伝わればよい。無理に多く見せる必要はない。" }
  ];
  var IV_BY_SITUATION = {
    inexperienced: [
      { q: "未経験の分野ですが、なぜ挑戦しようと思ったのですか。", h: "思いつきでないことを示す。学習の実績（期間・内容・成果物）を添える。" },
      { q: "これまでの経験のうち、この仕事に活かせるものは何ですか。", h: "職種は違っても、課題の見つけ方・段取り・折衝など持ち運べる力で接続する。" },
      { q: "入社後、どのように早く戦力になりますか。", h: "自走できる部分と、教わりたい部分を分けて言えると信頼される。" }
    ],
    blank: [
      { q: "離職期間について教えてください。", h: "事実を短く述べ、その間に何をしていたかと、現在は問題なく働ける状態であることを伝える。" },
      { q: "ブランク中に取り組んだことはありますか。", h: "資格・学習・アルバイト・家庭の事情など、実際のことを具体的に。" }
    ],
    shortterm: [
      { q: "前職の在籍期間が短いのはなぜですか。", h: "前職の批判にしない。認識の相違があった点と、次はどう確認して防ぐかを述べる。" },
      { q: "当社でも同じことにならないと言えますか。", h: "選考中に自分から確認したい点を挙げると、繰り返さない姿勢が伝わる。" }
    ],
    manager: [
      { q: "マネジメントされていた人数と役割を教えてください。", h: "人数だけでなく、評価・採用・目標設定のどこまで担ったかを明示。" },
      { q: "成果が出ないメンバーにどう関わりましたか。", h: "具体的な1事例で。仕組みで解決した話は評価されやすい。" },
      { q: "プレイヤーとマネージャーの比率はどのくらいでしたか。", h: "応募ポジションの期待値とすり合わせる質問。実態を正直に。" }
    ],
    highclass: [
      { q: "事業課題をどう捉え、何から着手しますか。", h: "入社前提の仮説でよい。情報が足りない前提を置いたうえで筋道を示す。" },
      { q: "これまでで最も大きな意思決定は何ですか。", h: "判断基準と、そのときに切り捨てた選択肢まで語れると深い。" }
    ]
  };
  var IV_BY_CAT = {
    occ_business: [{ q: "担当していた商材と、売上規模・目標達成率を教えてください。", h: "予算に対する達成率、担当顧客数、単価などの数字を用意しておく。" },
                   { q: "新規開拓と既存深耕、どちらが得意ですか。", h: "得意な方の再現性のあるやり方を1つ具体的に説明できるように。" }],
    occ_office:   [{ q: "業務の効率化で工夫したことはありますか。", h: "手順の見直し・ツール導入など。削減できた時間を数字で。" },
                   { q: "複数の依頼が重なったとき、どう優先順位をつけますか。", h: "判断基準と、関係者への確認・共有の仕方まで。" }],
    occ_it:       [{ q: "直近のプロジェクトの構成と、あなたの担当範囲を教えてください。", h: "使用技術・規模・チーム人数・自分の意思決定範囲を整理しておく。" },
                   { q: "技術のキャッチアップはどうしていますか。", h: "習慣として続けていることを、直近の具体例つきで。" }],
    occ_creative: [{ q: "ポートフォリオの中で、最も工夫した点はどこですか。", h: "見た目ではなく、課題と狙い、それをどう解いたかを語る。" },
                   { q: "フィードバックを受けたときの進め方を教えてください。", h: "受け止め方と、要望の背景を確認する姿勢を示す。" }],
    occ_medical:  [{ q: "これまでの勤務先の規模・診療科・夜勤の有無を教えてください。", h: "経験してきた患者層と対応範囲を具体的に。" },
                   { q: "チーム内での連携で心がけていることは何ですか。", h: "申し送り・記録・他職種との連携の実例で。" }],
    occ_service:  [{ q: "接客で心がけていることを教えてください。", h: "理念ではなく、実際にとっている行動で。クレーム対応の一例があるとよい。" },
                   { q: "売上や指標の改善に関わった経験はありますか。", h: "店舗全体の数字と、自分の貢献部分を分けて話す。" }]
  };
  var IV_REVERSE = [
    "入社後、最初の3か月で期待される成果はどのようなものですか。",
    "このポジションの1日の流れを教えていただけますか。",
    "チームの構成（人数・役割・年齢層）を教えてください。",
    "評価はどのような基準・頻度で行われますか。",
    "直近で組織が力を入れている課題は何ですか。",
    "前任の方はどのような理由で異動・退職されたのですか。",
    "入社前に勉強しておくとよいことはありますか。"
  ];
  function interviewQuestions(inp) {
    inp = inp || {};
    var out = [], flags = [];
    out.push({ group: "ほぼ必ず聞かれる質問", items: IV_COMMON });
    var cat = IV_BY_CAT[inp.occCat];
    if (cat) out.push({ group: "職種に応じた質問", items: cat });
    var sits = [];
    if (inp.inexperienced) sits.push("inexperienced");
    if (inp.blank) sits.push("blank");
    if (inp.shortterm) sits.push("shortterm");
    if (inp.manager) sits.push("manager");
    if (inp.highclass) sits.push("highclass");
    for (var i = 0; i < sits.length; i++) {
      out.push({ group: ({ inexperienced: "未経験からの応募で聞かれやすい質問", blank: "離職期間について聞かれやすい質問",
        shortterm: "在籍期間が短いときに聞かれやすい質問", manager: "マネジメント経験について聞かれる質問",
        highclass: "管理職・専門職の選考で聞かれる質問" })[sits[i]], items: IV_BY_SITUATION[sits[i]] });
      flags.push(sits[i]);
    }
    var n = 0;
    for (var j = 0; j < out.length; j++) n += out[j].items.length;
    return {
      groups: out, count: n, reverse: IV_REVERSE, flags: flags,
      prepare: [
        "回答は暗記せず、伝えたい要素を3つだけ決めておくと、聞かれ方が変わっても崩れません。",
        "実績はできる限り数字にします。売上・件数・期間・人数・改善率のいずれかを添えるだけで具体性が上がります。",
        "逆質問は2〜3個用意します。調べればわかることではなく、働き方や期待値の確認に使うのが効果的です。",
        "オンライン面接では、開始5分前に接続・カメラの高さ・逆光を確認します。"
      ],
      disclaimer: "実際の質問は企業・面接官によって異なります。ここに挙げたものは一般的な傾向であり、選考の通過を保証するものではありません。入力内容は端末の外に送信されません。"
    };
  }

  /* ---- ツール7: 年収と統計の比較 ---- */
  function salaryCompare(rec, myAnnualMan) {
    if (!rec || rec.averageSalary == null) return null;
    var mine = Number(myAnnualMan);
    if (!isFinite(mine) || mine <= 0) return null;
    var avg = rec.averageSalary, diff = mine - avg;
    var ratio = mine / avg;
    var band = ratio >= 1.2 ? "high" : ratio >= 1.05 ? "upper" : ratio >= 0.95 ? "mid" : ratio >= 0.8 ? "lower" : "low";
    return {
      label: rec.label, avg: avg, mine: Math.round(mine), diff: Math.round(diff),
      ratio: ratio, percent: Math.round(ratio * 1000) / 10, band: band,
      averageAge: rec.averageAge == null ? null : rec.averageAge,
      comment: ({
        high: "統計の平均を大きく上回っています。年収を軸に転職する場合は、現在の水準を維持できるかを早い段階で確認しておくのが安全です。",
        upper: "統計の平均をやや上回っています。次は年収以外の条件（裁量・働き方・スキルの蓄積）も合わせて比較すると判断しやすくなります。",
        mid: "統計の平均とほぼ同じ水準です。同じ職種でも業界・企業規模・地域で差が出るため、業界別・地域別のデータも見比べてみてください。",
        lower: "統計の平均をやや下回っています。ただし平均は年齢構成や企業規模の影響を受けます。年齢が平均より若い場合は差が出やすい点にご留意ください。",
        low: "統計の平均を下回っています。経験年数や勤務地の違いによる部分もあるため、同じ職種の業界別・地域別の水準と見比べることをおすすめします。"
      })[band],
      sourceName: rec.sourceName, sourceUrl: rec.sourceUrl, period: rec.period, note: rec.note,
      disclaimer: "統計の平均は年齢・企業規模・地域の構成に影響されるため、個人の適正年収を示すものではありません。転職後の年収を保証・予測するものでもありません。"
    };
  }

  return { diagnose: diagnose, review: review, chat: chat,
    agentInit: agentInit, agentStep: agentStep, agentResult: agentResult,
    takeHome: takeHome, unemploymentBenefit: unemploymentBenefit, paidLeave: paidLeave,
    overtimePay: overtimePay, resignationPlan: resignationPlan,
    interviewQuestions: interviewQuestions, salaryCompare: salaryCompare,
    _standardMonthly: standardMonthly, _salaryDeduction: salaryDeduction, _dailyBenefit: dailyBenefit,
    _AGENT_Q: AGENT_Q, _AGENT_SLOTS: AGENT_SLOTS, _types: TYPES, _docDef: DOC_DEF };
})();
