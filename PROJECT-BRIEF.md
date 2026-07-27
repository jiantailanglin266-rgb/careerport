# CAREERPORT（キャリアポート）— Global Affiliate Site Framework 設計ブリーフ

> 「キャリアの出港地。迷いを、進路に変える。」
>
> 元要件（Next.js + Supabase のフルスタック転職ポータル仕様）を、**global-affiliate-site スキルのひな形**
> （単一 `index.html` SPA + `data.js` + `build.mjs` SSG、ゼロ依存・静的ホスティング、
> Wikidata/Wikipedia ソーシング、アフィリエイト送客型）に再構成したもの。
> 参照実装：Mountain Peak（ja/en 約2,000山カタログ + 190記事 + アフィリエイト）。
> 姉妹ブリーフ：`realport/PROJECT-BRIEF.md`（同日作成・同型マッピング）。
> **画像はユーザー指定により全箇所 Wikipedia / Wikimedia Commons からの引用で統一する。**

---

## 0. リポジトリ調査結果

- 本リポジトリ（MOFURI.HP）は静的HTMLのブランドサイト。`terapp/`・`beauty-all-in/`・`realport/` 等、
  別ブランドのサブプロジェクトが同居する運用が既に確立している。
- フレームワーク・package.json・DB・認証・テスト設定は存在しない（＝スキルのゼロ依存構成と整合）。
- **CAREERPORT は `careerport/` サブフォルダとして新規構築**。既存ファイルには一切触れない。
- 公開は GitHub Pages（または任意の静的ホスト）。独自ドメイン移行可能な相対パス設計とする。
- 現状の問題点：該当なし（新規フォルダのため既存コードとの競合ゼロ）。

## 1. フレームワークへのマッピング判断（元仕様との差分）

元仕様は Next.js + Supabase を推奨していたが、本ブリーフはスキルの静的アーキテクチャを採用する。
差分は以下の通り「同じ事業目的（送客型転職メディア）を静的構成で満たす」形にマッピングする。

| 元仕様 | Framework 版の実装 |
|---|---|
| Next.js App Router + SSR/ISR | 単一 `index.html` SPA + `build.mjs` による全URL静的プリレンダー |
| Supabase PostgreSQL | `data.js`（`var DATA={...};` 1行、唯一の真実源） |
| Supabase Auth・会員機能（Q章） | **localStorage**（お気に入り・診断履歴・添削履歴・比較リスト・閲覧履歴・希望条件）。サーバー会員はフェーズ外 |
| 管理画面 `/admin`・CMS（9章） | `tools/*.mjs` 登録スクリプト群（記事登録・年収CSVインポート・サービス/ランキング更新・Wikidata取込） |
| JobProvider interface（B章） | 同名のアダプタ境界を静的側に定義。**実装は「提携準備中」表示 + デモ求人（明示）のみ**。正規API接続時に差し替え |
| AI Provider Adapter（K/L/M章） | **ルールベースをクライアントJSで完結**（API不要・キー露出ゼロ）。将来AI API化できる関数境界（`diagEngine()`/`reviewEngine()`/`chatEngine()`）を切る |
| AI書類添削の暗号化・保存期間（L章） | **入力テキストをどこにも送信しない**（ブラウザ内処理のみ・保存はlocalStorageオプトイン）。元仕様より強いプライバシー保証 |
| React Hook Form + サーバー検証 | 問い合わせ・メルマガは外部フォームサービス（Formspree等）or mailto。個人情報を自サーバーで持たない |
| Resend メール / メルマガ | フェーズ外（外部配信サービス接続前提。接続前は「準備中」表示） |
| Recharts（年収グラフ） | 自前SVGチャート（参照実装に実物あり。CDN依存禁止） |
| GA4/GTM イベント計測 | GA4 直貼り + `af_click` イベント（service_id/source_page/campaign付き。診断開始/完了・添削実行も同型イベント） |
| Vercel + Supabase | GitHub Pages（`data.js?v=N` キャッシュバスト + sw.js） |
| Vitest / Playwright | 純関数（診断ロジック・年収表示・添削チェッカー）に Node 単体テスト `tools/test-*.mjs`。E2Eはプレビュー目視ループで代替 |

**この構成の利点**：履歴書・職務経歴書という最重度の個人情報を一切サーバーで持たない＝
セキュリティ・法令リスクが構造的に消える。サーバー費ゼロ。SEO/LLMOはプリレンダー静的ページで最強クラス。
**制約**：リアルタイム求人DB・スカウト連携・サーバー会員は持てない → 「登録前の比較・検討・悩み解決の
入口を押さえる送客メディア」という事業モデルには影響しない。

## 2. ジャンル・マッピング表（スキル必須の最初の作業）

| Framework 概念 | Mountain Peak | CAREERPORT |
|---|---|---|
| **Entity**（コアカタログ） | 山（~2,000） | **職種**（厚労省職業分類 / job tag（日本版O-NET）ベース ~500。客観ソース） |
| curated tier（深掘り個別ページ） | 名山 ~200 | 主要職種 ~60〜100（元仕様の初期21職種 + 検索需要の高い職種） |
| catalog tier `cat:1`（個別ページなし） | その他の山 | その他の職種（基本情報のみ、SPA+404フォールバックで解決。薄ページ回避） |
| 数値スペック軸 | 標高 | **就業者数 / 平均年収**（公的統計由来・捏造不能。未登録は null=「データ準備中」） |
| 1–5 難易度/品質軸 | 登山難易度 | **データ整備度**（年収データ・記事・サービス紐付けの充実度。客観判定のみ。未整備=0） |
| **Sub-entity** | 登山ルート | **資格**（職種に紐づく国家資格・検定。Wikidata/Wikipediaソース）＋**企業**（Wikidata上場企業カタログ・従業員数軸） |
| **Ranking**（SEO主砲） | 百名山 | **転職サービス比較ランキング**（20代/女性/IT/ハイクラス/第二新卒…属性別）＋客観リスト（「平均年収の高い職種」「就業者数の多い職種」「都道府県別有効求人倍率」等・出典付き） |
| **Country/Region** | 国/山域 | **都道府県 / 8地方区分**（/area/ 地域別ページ） |
| **Article** | 山の読み物190本 | **転職ノウハウ記事**（退職・履歴書・職務経歴書・面接・年収交渉・失業保険・リスキリング…元仕様J章のカテゴリ全対応） |
| **People/Story**（権威コンテンツ） | 山を愛した人々 | **「日本の仕事の歴史」ストーリー**（職業の変遷・働き方の歴史・名経営者と労働運動の史実…Wikipedia出典・最厳格ファクト基準）。体験談は「サンプルストーリー」明示のみ |
| **Affiliate catalog** | 登山ギア | **転職エージェント / スカウト / 派遣 / アルバイト / スクール・リスキリング講座の送客サービス**（ASP） |
| context-gating（`lv`） | 難易度でギア出し分け | **年代 × 職種 × 年収帯 × 診断結果**でサービス出し分け（20代未経験→総合型+第二新卒特化、年収600万以上→ハイクラス、IT職種→IT特化…） |
| チャットボット | 山コンシェルジュ | **AIキャリア相談**（ルールベース。内定・年収保証の断定禁止、常時免責表示） |
| ログブック（localStorage） | 登頂記録 | **マイページ相当**（お気に入り求人/サービス・診断結果保存・添削履歴・比較リスト・閲覧履歴） |

## 3. サイトマップ（元仕様 A〜R → Framework URL）

言語は **ja 単独で開始**（国内向けサービスのため）。ただしスキル標準の hreflang/LOCALES 構造は
保持し、`en` 追加を1設定で行えるようにする（仮定 §9-1）。

```
/                                  トップ（FV・検索・悩み別入口・サービス比較・診断導線・職種/業界/地域/年収・記事・FAQ・最終CTA）
/jobs/                             求人検索（「提携準備中」表示 + デモ求人明示 + JobProviderアダプタの器）
/jobs/<slug>/                      求人詳細（デモのみ。実求人接続後に JobPosting JSON-LD 解禁）
/services/                         転職サービス比較トップ（= Ranking + Affiliate の合体ページ）
/services/agent/ /scout/ /job-site/ /dispatch/ /part-time/   種別別比較
/services/<slug>/                  サービス個別（メリデメ・対象年代/年収/職種・PR表記・計測付き公式リンク）
/career/<attr>/                    属性別ページ（20s/30s/40s/50s/women/second-career/inexperienced/
                                   high-class/manager/freelance/return-to-work）
/occupation/                       職種トップ（カテゴリグリッド）
/occupation/<slug>/                職種個別（= Entity 個別ページ。curated tier のみ静的生成）
                                   └ 年収/求人/未経験転職はページ内セクション。独立URL化は
                                     データが揃った段階で（薄ページ回避）
/industry/                         業界トップ
/industry/<slug>/                  業界個別（16業界。市場概要・平均年収・代表職種・主要企業）
/area/                             地域トップ（47都道府県グリッド）
/area/<pref>/                      都道府県ページ（= Country/Region ページ。求人傾向・年収・主要産業）
/salary/                           年収データベース トップ（職種別/業界別/地域別/年代別タブ）
/salary/<slug>/                    年収個別テーマ（出典・時点必須。未登録は「データ準備中」）
/companies/                        企業情報（Wikidata上場企業カタログ + 出典・更新日必須）
/companies/<slug>/                 企業個別（curated のみ静的生成）
/stories/                          体験談・ストーリー（サンプル明示 + 「日本の仕事の歴史」story記事）
/learning/                         リスキリング・スクール比較（programming/qualification/english/marketing）
/guide/                            記事一覧（カテゴリ: start/resignation/resume/career-history/interview/
                                   salary-negotiation/unemployment/career/reskilling/story）
/guide/<slug>/                     記事個別（目次・著者・監修・出典・更新日・FAQ・JSON-LD・文脈CTA）
/tools/career-diagnosis/           AIキャリア診断（ルールベース・結果保存・共有URL）
/tools/resume-review/              AI書類添削（履歴書。クライアント完結・非送信）
/tools/career-history-review/      職務経歴書添削 / /motivation-review/ 志望動機 / /self-promotion-review/ 自己PR
/tools/salary-check/               年収比較ツール（自分の年収 vs 統計。出典明示）
/ai-consultation/                  AIチャット相談（ルールベース）
/about/ /company/ /editorial-policy/ /expert-supervision/ /data-policy/ /advertising-policy/
/privacy/ /terms/ /disclaimer/ /contact/ /faq/ /sitemap/ /correction-request/   固定ページ
404.html                           SPAフォールバック（catalog tier 職種・企業の動的解決）
```

**SEO 4層構造の対応**：第1層=比較・ランキング（/services/・/career/）、第2層=職種×業界×地域
（/occupation/ /industry/ /area/）、第3層=悩み解決（/guide/）、第4層=データ・ツール（/salary/ /tools/）。
内部リンクの基本動線：**悩み記事 → 職種/属性ページ → サービス比較 → 送客** と
**職種ページ → 年収データ → サービス比較 → 送客**。各ページのCTAは `data.js` の `ctaRules`
（記事カテゴリ・職種・属性・診断回答 → 推奨サービス種別）で自動出し分けする。

## 4. `data.js` スキーマ（CAREERPORT 版）

```js
var DATA={
  occupations:[...],   // ENTITY: 職種（curated + cat:1 カタログ）
  qualifications:[...],// SUB-ENTITY: 資格（occupationIds で紐付け）
  companies:[...],     // SUB-ENTITY相当: 企業（Wikidataソース。curated + cat:1）
  services:[...],      // 転職サービス（= AF カタログの実体。ASP送客）
  schools:[...],       // スクール・講座（services と同型・kind違い）
  jobs:[...],          // デモ求人のみ（isDemo必須。実求人はProvider接続後）
  rankings:[...],      // 比較・客観ランキング
  articles:[...],      // ノウハウ記事 + story（日本の仕事の歴史）
  industries:[...],    // 業界16件（= カテゴリファセット）
  prefectures:[...],   // 47件（= countries 相当）
  regions:[...],       // 8地方区分
  salaryData:[...],    // 年収レコード（出典必須。未登録は「データ準備中」）
  stories:[...],       // 体験談（isSample必須）
  faqs:[...], ctaRules:[...], siteSettings:{...}
};
```

主要レコード形：

```js
// occupations[] — curated tier（個別静的ページあり）
{ id:"oc_sales", slug:"sales", categoryId:"occ_business", industryIds:["in_it","in_hr"],
  workers:8640000,            // 就業者数（公的統計由来。数値スペック軸。未確認は null）
  dataLevel:2,                // 0=基本情報のみ 1=年収データあり 2=記事・サービス紐付けあり（客観判定のみ）
  status:"published",
  translations:{ ja:{ name:"営業", summary:"…", skills:"…", careerPath:"…", inexperienced:"…" } } }

// occupations[] — catalog tier（cat:1、SSGは if(o.cat) continue;）
{ id:"oc_…", slug:"…", categoryId:"…", workers:null, dataLevel:0,
  status:"published", cat:1, translations:{ ja:{name, summary} } }

// salaryData[] — 架空年収の禁止をスキーマで強制
{ occupationId:"oc_sales", industryId:null, prefId:null, ageGroup:"all", genderGroup:"all",
  averageSalary:null, medianSalary:null, salaryMin:null, salaryMax:null,  // null=未登録（0や推定値で埋めない）
  sampleCount:null, period:"2025",
  sourceName:"厚生労働省 賃金構造基本統計調査", sourceUrl:"https://…",
  sourceDate:"2026-03-31", updatedAt:"2026-07-27" }

// services[] — 送客サービス（AF_GEAR 相当）
{ id:"sv_demo1", slug:"demo-agent-a", isDemo:true,                 // ★デモ識別子必須
  kind:"agent",                // agent|scout|job-site|dispatch|part-time|school
  affiliateUrl:"", trackingCode:"",                                 // 空=CTAボタン非表示（正直運用）
  jobCount:null, ranking:1, isPR:true,
  gate:{ ages:["20s","30s"], salaryBands:["-400","400-600"],        // 文脈ゲート
         occCategories:["occ_it"], flags:["inexperienced","second-career"] },
  translations:{ ja:{ name:"（デモ）転職エージェントA", merits:"…", demerits:"…", target:"…" } } }

// jobs[] — デモ求人（実求人接続まではこの形のみ）
{ id:"jb_demo1", slug:"demo-job-1", isDemo:true, companyId:null,
  occupationId:"oc_sales", prefId:"pf_tokyo", employmentType:"fulltime",
  salaryMin:null, salaryMax:null, sourceUrl:"", expiresAt:null,
  translations:{ ja:{ title:"（デモ）法人営業", description:"…" } } }

// companies[] — Wikidataソース（employees = 数値軸、出典・更新日必須）
{ id:"co_…", slug:"…", industryId:"in_it", prefId:"pf_tokyo",
  employees:null, founded:null, listed:true, wikidataId:"Q…",
  sourceName:"Wikidata", updatedAt:"2026-07-27",
  status:"published", cat:1, translations:{ ja:{name, summary} } }

// articles[] — Mountain Peak と同形（category, authorName, supervisorName,
//   publishedAt(Date.UTC固定), factCheck, sources[], translations.ja.{title,metaDesc,body}）
//   body は artBody() マイクロ記法（## / ** / [img:path|クレジット] / --- / *note*）
//   story記事は person/related/sources[] 必須（fact-policy 準拠）
```

規約：ID接頭辞 `oc_ ql_ co_ sv_ sc_ jb_ rk_ art_ in_ pf_ rg_ st_`。全レコード denormalize・
文字列ID参照・ランタイムjoinは `.find()` のみ。**一括登録は必ず `tools/register-*.mjs` 経由**
（data.js手編集禁止）。変更のたび `data.js?v=N` をバンプ（load-bearing rule #2）。

## 5. データソーシング（捏造ゼロの担保）

| データ | ソース | 方法 |
|---|---|---|
| 職種（名称・分類・就業者数） | **厚労省職業分類 / job tag（日本版O-NET）/ e-Stat 国勢調査** | `tools/import-occupations.mjs`。政府標準利用規約（CC BY 4.0互換）に基づき出典明記。利用規約は公開前チェックリストで最終確認 |
| 年収データ | **賃金構造基本統計調査（e-Stat）** | 初期は手動CSV → `tools/import-salary-csv.mjs`。出典名・出典URL・データ時点を必須カラムに。未接続は「データ準備中」表示 |
| 企業（名称・従業員数・業界・本社所在地） | **Wikidata** | `tools/import-wikidata.mjs`。日本の上場企業SPARQL（`wdt:P1128` 従業員数）。LIMIT・リトライ・重複排除はスキル準拠 |
| 資格 | Wikidata / Wikipedia | 国家資格・主要検定のみ。職種に紐付け |
| 有効求人倍率・雇用統計 | 厚労省 一般職業紹介状況（e-Stat） | 地域ページ・客観ランキングの根拠データ。出典・時点必須 |
| 職種・業界・地域の概況テキスト | Wikipedia（要約・出典明記） | CC BY-SA 4.0 帰属表示をページ・llms.txt 両方に |
| **画像（全箇所）** | **Wikipedia / Wikimedia Commons のみ**（★ユーザー指定） | 職業風景・オフィス街・産業写真・都市景観・歴史写真（story記事）。`tools/fetch-commons-images.mjs` でDL→目視検証→`images/…`。キャプションに `Photo: <作者> / Wikimedia Commons, <ライセンス>` を必ず表示。PDはPD表記。**素材サイト・撮り下ろし・AI生成画像は使わない** |
| ニュース | RSS ヘッドラインのみ | 雇用・労働関連ニュースのタイトル+ソース+外部リンクのみ。本文転載禁止 |
| 求人情報 | **転載しない** | 他社保有求人の無断掲載・スクレイピング複製は行わない。優先順位（正規API→提携CSV→ASP求人→手動登録→デモ明示）は元仕様B章の通りとし、接続まではアダプタの器 + デモ求人のみ |
| 口コミ・体験談 | **創作しない** | 実口コミが得られるまで掲載しない。サンプルは「サンプルストーリー」明記（元仕様O章準拠） |

## 6. ファクトポリシー（YMYL 全面適用）

転職・雇用・年収・退職は YMYL。スキルの fact-policy を**そのまま全文適用**した上で、
CAREERPORT 固有の追加規則：

1. **架空数値の禁止**：`salaryData`・求人数・登録者数・成功件数に推定値やそれらしい数字を
   入れない。null は「データ準備中」「掲載準備中」として表示（元仕様A章の指示と一致）。
2. **診断・添削・相談の断定禁止**：「適職を断定しない/転職成功・年収上昇・採用を保証しない/
   参考情報である」を結果画面に常時表示。差別的判断をしない（性別・年齢のみで選択肢を制限する
   ロジックを書かない）。経歴の捏造・誇大表現を生成しない（添削はルールベースの指摘のみ）。
3. **書類添削のプライバシー**：入力テキストはブラウザ外に送信しない・デフォルト保存しない・
   保存はlocalStorageオプトイン+ワンタップ削除。この設計自体をページに明記する。
4. **デモデータの明示**：転職サービス・求人・スクール・体験談のダミーは `isDemo:true` +
   表示名に「（デモ）」接頭辞 + ページ内「サンプル掲載です」バナー。実在誤認を構造的に防ぐ。
5. **PR分離**：`isPR:true` のカードは PR バッジ + `rel="sponsored nofollow noopener"`。
   ランキング根拠（客観指標か編集評価か）を /advertising-policy/ に明記。「絶対」「必ず」
   「確実」等の断定表現を全サイトで禁止。比較結果を報酬額で不当に操作しない。
6. **法令線引き**（サイト全体の免責 + フッター常設）：職業紹介・条件交渉・内定保証・企業の
   代理は行わない送客型メディアであることを明記。**募集情報等提供事業（職業安定法）の届出
   要否・特定募集情報等提供該当性は、求人情報を実掲載する前に専門家確認**（READMEの法務
   チェックリスト筆頭項目）。求人表示は雇用形態・賃金・業務内容・受動喫煙対策等の必須項目を
   保存できる構造（§4 jobs スキーマ）とし、性別・年齢を限定する差別的表示をしない。
7. **記事の編集ステータス**：`status: draft|review|published|archived` + `factCheck:"reviewed"` で
   バッジ表示（reviewed のみ）。AI下書きの自動公開禁止（register スクリプトは draft 投入 →
   人間確認後に published へ）。story 記事は `sources[]` 必須・文末ファクトノート必須。
8. **著者・監修**：`authorName`（CAREERPORT編集部）+ `supervisorName`（キャリアコンサルタント等。
   実在者の許諾が取れるまでは「監修準備中」とし架空の専門家を作らない）。
   訂正依頼窓口（/correction-request/）を全記事フッターからリンク。

## 7. アフィリエイトモジュール

```js
var AF_CONF={ ga4:"G-XXXX", prefix:{} };   // ASP計測プレフィックス。承認前は空＝リンク非表示
```

- Mountain Peak の `AF_GEAR` を `DATA.services`（+ `DATA.schools`）に統合（§4）。
  **ASP未承認の間は `affiliateUrl:""` → CTAボタン自体を出さない**（比較UIとランキングの器を
  先に完成させ、承認後にURL投入だけで収益化。REALPORT と同じ意図的変更）。
- クリック計測：`afA()` 相当のリンクビルダーが GA4 `af_click` を送信
  （`service_id / source_page / campaign`）。診断開始/完了・添削実行・外部応募遷移も
  同型のGA4イベントで計測（元仕様の計測要件をクライアントイベントで充足）。
- **文脈ゲート**：`service.gate`（年代×年収帯×職種カテゴリ×フラグ）と、閲覧中ページの文脈
  （記事カテゴリ・職種・属性ページ・診断回答）を突合して最適サービスを自動表示。
  例：20代未経験記事 → 総合型+第二新卒特化、IT職種ページ → IT特化、年収600万超の診断結果 →
  ハイクラス+スカウト型、リスキリング記事 → スクール枠。
- 収益モデル対応順：①エージェント/スカウトASP → ②派遣・アルバイトASP → ③スクール・講座ASP →
  ④AdSense → ⑤直接掲載（企業・スクールの掲載枠）→ ⑥タイアップ記事（PR表記必須）→
  ⑦プレミアム機能・イベント（フェーズ外）。
- 開示：フッター + 各比較ページ冒頭に「本サイトはアフィリエイト広告を含みます」を常設。

## 8. SPA / SSG / SEO / LLMO

スキルの architecture.md / ssg-build.md 準拠。CAREERPORT 固有の設定のみ記す。

- **デザインシステム**（CSS変数。元仕様§4のトークンをそのまま採用）：
  `--navy-950:#081426 --navy-900:#10213e --navy-800:#1a3157 --gold-500:#bd902a
  --gold-400:#d2a846 --surface:#f6f7f9 --border:#dfe3e8 --text:#182238 --muted:#667085
  --success:#16845b --error:#c53b3b`。
  フォント：Noto Sans JP（本文）+ Noto Serif JP（見出し・英字ロゴ「CAREERPORT」）+ Inter（英字補助）。
  モチーフ：港・航路・羅針盤・都市夜景の抽象SVG背景（細ライン・グリッド・軽量・パララックス禁止）。
  モバイルファースト・清潔感・余白重視。**レスポンシブ上書きは `<style>` 末尾**（rule #3）。
- ヘッダー/ナビ：元仕様§5準拠（PC: 求人/比較/年収/職種/業界/ノウハウ/診断、主要CTA
  「無料でキャリア診断」、モバイル: 下部固定ナビ 求人/比較/診断/記事/マイページ）。
- ルーター：ハッシュ/パスルーター。新規描画関数・設定は `/* 初期化 */` より**上**に定義（rule #1）。
- チャットボット枠 → AIキャリア相談（ルールベース・免責常時表示）。ログブック枠 → マイページ相当。
- SSG 出力：curated 職種・企業個別ページ（`cat:1` は除外、rule #6）、記事、比較、属性、業界、
  地域、年収、ツール、固定ページ。各ページに title/meta/canonical/OGP/パンくず。
- JSON-LD：Organization / WebSite+SearchAction / BreadcrumbList / Article / FAQPage /
  ItemList（比較・ランキング）/ **Occupation + estimatedSalary（職種・年収ページ。出典つき）** /
  **Dataset（/salary/ 年収DB。出典・時点つき）** / Course（スクール）。
  **JobPosting は実求人（正規ソース・期限内）にのみ出力**。デモ求人・期限切れには出さない
  （元仕様§11の禁止事項をSSG側で構造的に強制：`if(job.isDemo||expired) skip`）。
- LLMO：`llms.txt`（サイト要約 + 主要URL + データ出典 + CC BY-SA帰属）、AIクローラー許可の
  robots.txt、各ページ冒頭に引用可能な2〜3文の結論要約、質問形見出し、FAQ、更新日、比較表、
  定義文。sitemap.xml / image-sitemap / RSS / 404.html / sw.js / manifest 自動生成。

## 9. 仮定（明示）— 後から変更しやすい設計で進める

1. **言語**：ja 単独で開始（国内サービス）。LOCALES 配列と translations 構造は ja/en 両対応で
   実装し、en 追加は翻訳投入のみで済むようにする。
2. **会員機能**：localStorage 実装で代替（元仕様Q章のサーバー会員・メール認証は PHASE 4 で
   fullstack-saas-builder 案件として再検討）。
3. **フォーム**：問い合わせ・メルマガは外部サービス接続前提。接続前は「準備中」を明示
   （架空の受付をしない）。
4. **転職サービス**：ASP承認が下りるまで全件 `isDemo:true`。実在サービスを登録する場合は
   事実確認済みの基本情報のみ（求人数・満足度を推測で入れない。元仕様§18準拠）。
5. **求人検索**：正規データ提携まで「提携準備中」+ デモ求人 + JobProvider アダプタ定義のみ。
   無断転載は行わない。
6. **AI機能**：3機能（診断・添削・相談）ともルールベースのクライアントJSで完結。
   Anthropic API 接続は関数境界の差し替えで将来対応（構造化JSON+検証の設計は境界に温存）。
7. **ホスティング**：GitHub Pages（`careerport` 用の新規リポジトリを推奨。MOFURI.HP 同居でも
   動くがドメイン戦略上分離が望ましい）。
8. **画像**：全箇所 Wikipedia / Wikimedia Commons 引用（ユーザー指定。§5参照）。

## 10. 実装順序（スキル Build Order 準拠）

| # | フェーズ | 産出物 | 対応する元仕様PHASE |
|---|---|---|---|
| 1 | データモデル | `data.js` 初期版（47都道府県・8地方・16業界・職種カテゴリ+初期21職種・記事カテゴリ・デモサービス8件・デモ求人20件・FAQ・ctaRules） | PHASE 0 |
| 2 | SPA シェル | `index.html`（ネイビー×ゴールドDS、ルーター、i18n器、トップ/求人/比較/属性/職種/業界/地域/年収/記事/固定ページの全ビュー、AI診断+書類添削4種+チャット相談、マイページ、単体テスト付き純関数） | PHASE 1 |
| 3 | 実データ投入 | `tools/import-occupations.mjs`（職業分類→catalog ~500件）、`import-wikidata.mjs`（上場企業）、`import-salary-csv.mjs`（賃金構造基本統計調査）、Commons画像パイプライン | PHASE 1–2 |
| 4 | ファクトポリシー適用 | 免責・PR表記・出典・更新日・「データ準備中」「（デモ）」表示の全ページ監査 | PHASE 1（必須） |
| 5 | アフィリエイトモジュール | `AF_CONF`・afA()・af_click 計測・文脈ゲートCTA・広告掲載方針ページ | PHASE 1–3 |
| 6 | SSG | `build.mjs`（全静的ページ・JSON-LD・sitemap・robots・llms.txt・404・sw.js） | PHASE 1 |
| 7 | デプロイ運用 | GitHub Pages ループ、`?v=N` バンプ手順、記事量産（register.mjs で15本→50本→…）、README（法務チェックリスト・非エンジニア向け手順） | PHASE 1→2 |

**想定ディレクトリ構成**：

```
careerport/
├ index.html          SPA本体（スタイル・スクリプト内包）
├ data.js             唯一の真実源（var DATA={...}; 1行）
├ build.mjs           SSG（全静的ページ生成）
├ 404.html sw.js manifest.webmanifest robots.txt llms.txt sitemap.xml（build生成）
├ images/             Commons取得画像（occupations/ industries/ areas/ articles/）
├ tools/              import-*.mjs / register-*.mjs / fetch-commons-images.mjs / test-*.mjs
├ ja/                 プリレンダー出力（build生成）
└ README.md           セットアップ・運用・法務チェックリスト
```

検証ゲート（各フェーズ末）：プレビューで目視 → 診断/添削ロジックの単体テスト green →
リンク切れゼロ → `data.js` パース検証 → デプロイ。一度に巨大な未検証コードを作らない。

---
*作成日: 2026-07-27 / このブリーフ自体が「後から変更しやすい設計」の一部。仮定が変わったら本ファイルを更新すること。*
