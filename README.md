# CAREERPORT（キャリアポート）

> キャリアの出港地。迷いを、進路に変える。

転職・求人・年収・キャリア情報の**送客型メディア**。global-affiliate-site フレームワーク
（単一 `index.html` SPA + `data.js` + `build.mjs` SSG、ゼロ依存・静的ホスティング）で構築。
設計の全体像は [PROJECT-BRIEF.md](PROJECT-BRIEF.md) を参照。

## 構成ファイル

| ファイル | 役割 |
|---|---|
| `index.html` | SPA本体（デザイン・全ビュー・ルーター・AIツールUI）|
| `data.js` | 唯一のデータ源（`var DATA={...};` 1行）。**手編集禁止** |
| `logic.js` | AI診断・書類添削・チャット相談のルールベースエンジン（入力は外部送信されない）|
| `build.mjs` | SSG。静的ページ151枚 + sitemap/robots/llms.txt/404/sw を生成 |
| `tools/seed.mjs` | シードデータ生成（data.js を書き出す）。`tools/data/*.json` があればマージ |
| `tools/test-logic.mjs` | ロジック単体テスト（31件）|
| `tools/import-wikidata-companies.mjs` | Wikidata → 上場企業カタログ取得（→ tools/data/companies.json）|
| `tools/import-salary-csv.mjs` | 年収CSV取り込み（出典必須・検証つき → tools/data/salary.json）|
| `tools/register-articles.mjs` | 記事一括登録（必ず draft で登録 → 人間確認後に published へ）|
| `tools/fetch-commons-images.mjs` | Commons 画像の検索・DL・クレジット取得（DL後は必ず目視検証）|

## セットアップ〜デプロイ手順（非エンジニア向け）

1. Node.js をインストール（https://nodejs.org 推奨版）
2. データを変更したら：`tools/seed.mjs` を編集 → 以下を実行

```bash
cd careerport && node tools/seed.mjs && node tools/test-logic.mjs && node build.mjs
```

3. **`data.js` を変更したら必ず** `index.html` 内の `data.js?v=1` の数字を +1 する
   （logic.js 変更時は `logic.js?v=1` も同様）。これを忘れると閲覧者に古いデータが表示される。
4. ローカル確認：MOFURI.HP 直下で `python -m http.server 8830` →
   http://localhost:8830/careerport/ja/ を開く（Claude Code なら launch.json の `careerport`）
5. 公開：**GitHub Pages（公開中）** https://jiantailanglin266-rgb.github.io/careerport/
   - リポジトリ: https://github.com/jiantailanglin266-rgb/careerport （careerport/ フォルダ単独の
     独立リポジトリ。MOFURI.HP=mofuri-jp とは別）
   - デプロイループ: 変更 → seed → test → build → `?v=N` バンプ →
     `git add -A && git commit && git push`（push が拒否されたら `git pull --rebase`）
   - 独自ドメイン移行時は `build.mjs` の `SITE` 定数を変更して再ビルド。

## 運用手順

### 記事を追加する
少数なら `tools/seed.mjs` の `articles` 配列に `mkArt(...)` を追加（本文はマイクロ記法:
`## 見出し` / `**強調**` / `[img:パス|キャプション+クレジット]` / `---` / `*注記*` / 空行=段落）。
量産時は ESM バッチファイルを書いて `node tools/register-articles.mjs <batch.mjs>` で一括登録
→ **必ず draft で入る**ので、内容確認後に `tools/data/articles-extra.json` の status を
published に変更 → seed→v バンプ→build。

### 転職サービス（ASP）を実データ化する
1. ASP（A8.net 等）で広告主の提携承認を得る
2. `tools/seed.mjs` の該当サービスから `isDemo:true` と「（デモ）」を外し、
   **事実確認済みの情報のみ**を記載（求人数・満足度を推測で書かない。未確認は null）
3. `affiliateUrl` に計測リンクを設定（空の間はCTA非表示のまま）
4. `/advertising-policy/` にランキングの掲載基準を記載してから公開する

### 実求人の接続（パイプラインは実装済み・データ未接続）

**手順は「①法務クリア → ②提供元の確保 → ③取り込み」の順。①を飛ばさないこと。**

#### ① 法務クリア（着手前に必須）
求人情報を実掲載すると、事業が **募集情報等提供事業（職業安定法）** に該当し得る。
- 「特定募集情報等提供事業者」に当たる場合、**厚生労働大臣への届出**が必要
- 該当性は、求人情報の入手経路（提供元からの提供か／自ら収集か）と、
  求職者情報の取扱いの有無で変わる。**弁護士または社労士に確認してから接続する**
- あわせて確認：労働条件明示のルール、差別的取扱いの禁止（性別・年齢等）、
  苦情処理体制、個人情報の取扱い

#### ② 提供元の選択肢
| 経路 | 内容 | 難易度 |
|---|---|---|
| **企業・代理店の直接掲載** | 掲載契約を結び CSV で受領。最も始めやすく、収益（掲載料）にも直結 | 低 |
| **ATS のJobPostingフィード** | 採用管理システムが出す標準フィードを許諾を得て取り込む | 中 |
| **ハローワーク求人情報オンライン提供** | 厚労省の制度。申込み・承認が必要。公的で量が多い | 中〜高 |
| **求人サイトのアフィリエイト/API** | ASP・提携先の規約に従う。リンク先は提携先サイト | 中 |

**やらないこと**：許諾のないサイトのスクレイピング、他社求人の無断転載。
ハローワークインターネットサービスの画面取得も規約違反のため行わない。

#### ③ 取り込み（実装済みのコマンド）
```bash
node tools/import-jobs.mjs --list                              # プロバイダー一覧
node tools/import-jobs.mjs csv --path tools/data/jobs-sample.csv   # CSV（テストデータで動作確認）
node tools/import-jobs.mjs jobposting --url https://…/jobs.json    # 標準フィード
node tools/import-jobs.mjs --prune                             # 期限切れの削除のみ
node tools/seed.mjs && node build.mjs                          # 反映（?v= のバンプも忘れず）
```
- 提供元の様式は `tools/data/jobs-template.csv`（29列）。新しい提供元は
  `tools/job-providers/` にアダプターを1本足せば以降の処理は共通
- **取り込み時に自動で弾かれるもの**（`tools/job-providers/_core.mjs`）
  - 法定明示項目（業務内容・契約期間・試用期間・就業場所・就業時間・休日・賃金・
    加入保険・受動喫煙防止措置・募集主体）が欠けている求人
  - 性別・年齢を限定する差別的な募集条件
  - 掲載期限切れ、出典URL・応募URLがない、https でない、重複
- 取込結果は `tools/data/jobs-log.json` に履歴として残る（運用記録・監査用）

#### 接続後にサイト側で自動的に切り替わること
- 求人検索・職種ページ・地域ページが**デモ求人から実求人に切り替わる**（混在しない）
- 求人詳細に募集要項（法定項目すべて）・掲載元・掲載期限・情報取得日を表示
- 応募ボタンは外部サイトへ `rel="nofollow noopener"` で遷移し、`job_apply_click` を計測
- **JobPosting 構造化データを出力**（実求人・期限内・出典ありのものだけ。デモには一切出さない）
- 実求人の個別ページを静的生成し、sitemap に載る

#### 定期更新
`.github/workflows/jobs-refresh.yml`（毎日05:00 JST）。リポジトリ変数 `JOB_PROVIDER` を
設定すると取り込みまで自動化される。未設定の間は期限切れ削除とビルドのみ実行される。

### 年収データ（投入済み・更新方法）
**投入済み**：厚生労働省「令和7年賃金構造基本統計調査」（職種）第1表（e-Stat, statInfId=000040421116）。
`tools/data/src/wage-census-r7-occ1.xlsx` → `python tools/import-wage-census.py` → salary.json（143区分）。
- 年収は「きまって支給する現金給与額×12＋年間賞与」の算出値。算出式・出典・統計区分名をサイト側で常時表示
- 統計区分→職種slugの対応は importer 内 `NAME_MAP`（85区分/113職種）。中核が一致する場合のみ対応付け、
  1つのslugを複数区分に割り当てるとエラーになる
- **翌年更新**：新年度の第1表xlsxを e-Stat から取得して src/ を差し替え → importer の SOURCE（年・URL・公表日）を
  更新 → 実行 → seed → v バンプ → build
- **業界・都道府県（投入済み）**：`python tools/import-wage-census-industry.py`
  - 業界: 産業中分類の第1表13区分（産業計＋12業界対応）。産業大分類のxlsxが公表されていないため、
    対応する**中分類**の値を区分名明示で掲載（大分類値として偽装しない）。対応表はスクリプト内 INDUSTRY_FILES
  - 都道府県: 都道府県別第2表（4分割xlsx）から47都道府県×職業大分類11区分=517行。
    各エリアページに職業別平均年収表として表示
  - 元xlsxは tools/data/src/industry/ にキャッシュ（statInfId.xlsx）。翌年更新は INDUSTRY_FILES /
    PREF_FILES の statInfId と SOURCE_BASE を新年度のものに差し替えて再実行
- 手動追加は従来どおり `tools/import-salary-csv.mjs`（出典3列必須）

### 記事のヒーロー画像
`tools/seed.mjs` の `ARTICLE_HERO`（記事slug → images.json のキー）で割り当てる。
新しい画像は image-plan.mjs に `art:<名前>` キーを追加 → fetch → **目視検証** → ARTICLE_HERO に登録。
未割り当ての記事はヒーローなしで表示される。OGP画像も自動で追随する。

### 企業カタログを更新する
`node tools/import-wikidata-companies.mjs` → seed→v バンプ→build。
TSE上場×従業員数登録あり（Wikidata）の上位企業を基本情報のみで取得する。
評価・年収・社風など判断を要する情報は取得しない設計。

### 画像を使う
全箇所 **Wikipedia / Wikimedia Commons** から。素材サイト・AI生成画像は使わない。

- **キービジュアル（職種/業界/カテゴリのヒーロー・サムネイル）**：`tools/image-plan.mjs` に
  key（`occ:<slug>` / `ind:<slug>` / `cat:<カテゴリid>`）と検索クエリ or `file:` 指定を書き、
  `node tools/fetch-image-plan.mjs` で一括取得（ライセンス不明・800px未満は自動拒否）→
  **必ず全点を目視検証** → NG は `file:` 指定で差し替えて `node tools/fetch-image-plan.mjs <key>`。
  クレジットは images.json に記録され、サイト側で常時表示される。
  表示のフォールバックは `occ:slug → cat:カテゴリ → 画像なし`。
- **記事内画像**：`node tools/fetch-commons-images.mjs get "File:X.jpg" images/articles/foo.jpg`
  でDL→目視検証→ `[img:images/articles/foo.jpg|キャプション。Photo: 作者 / Wikimedia Commons, ライセンス]` 記法。

### 職種を追加する
`tools/data-occupations/*.mjs` に
`[slug, 名称, カテゴリid, 業界slug|区切り, 仕事内容, スキル, キャリアパス, 未経験目安]` を追記
→ seed→v バンプ→build。不明カテゴリ・業界slug・重複slugは seed が検出する。
統計値は書かない・資格必須職は必須と明記（国家資格職の「未経験可」誤記に注意）。

### GA4 / 広告計測
`index.html` の `AF_CONF.ga4` に測定IDを設定し、GTM/gtag スニペットを `<head>` に追加。
既に `af_click` / `job_search` / `diagnosis_complete` / `review_run` / `chat_message`
イベントが dataLayer に送出されている。

### バックアップ / データ削除
- サイト全体が git 管理＝バックアップは push で完結
- 利用者データはすべて利用者の端末内（localStorage）のみ。サーバー側に個人情報は存在しない
- 利用者はマイページ「保存データをすべて削除」で全消去できる

## 公開前チェックリスト（法務・E-E-A-T）

- [ ] **募集情報等提供事業（職業安定法）**：求人情報を実掲載する前に、届出要否・
      特定募集情報等提供への該当性を専門家（弁護士/社労士）に確認する ※最重要
- [ ] 運営会社情報（`/company/`）を実名・所在地・連絡先で確定する
- [ ] 特定商取引法・景表法（ステマ規制）の表示要件を確認（PR表記は実装済み）
- [ ] お問い合わせ・訂正依頼の外部フォーム（Formspree等）を接続する
- [ ] 監修者（キャリアコンサルタント等）の実名監修体制を作る（架空監修は禁止）
- [ ] e-Stat / job tag データの利用規約を確認して出典表記を確定する
- [ ] ASP規約の表記要件（リンク改変禁止等）を確認する
- [ ] `build.mjs` の SITE 定数を本番URLに変更して再ビルドする
- [ ] Google Search Console / GA4 を設定する

## トラブルシューティング

| 症状 | 対処 |
|---|---|
| データを変えたのに表示が変わらない | `index.html` の `data.js?v=N` をバンプしたか確認（SWがcache-first）|
| 新しい関数が undefined | `index.html` の `/* 初期化 */` より上で定義しているか確認 |
| モバイルでCSSが効かない | レスポンシブ上書きは `<style>` の**末尾**に置く |
| ビルドが DATA not found | `data.js` が `var DATA={...};` 1行形式か確認（手編集で壊れやすい）|
| 直リンクで404になる（ローカル） | GitHub Pages では 404.html がSPAフォールバックとして機能する。ローカルは `/careerport/ja/` から遷移する |

## ロードマップ（PROJECT-BRIEF §10）

1. ✅ PHASE 1相当：SPA・SSG・デモデータ・AI3ツール・固定ページ・SEO/LLMO基盤
2. 実データ投入：職業分類インポート（catalog職種 ~500）・Wikidata企業・年収CSV・Commons画像
3. 収益化：ASP承認 → サービス実データ化 → AdSense → 直接掲載
4. 拡張：en ロケール追加・ニュースRSS cron・記事量産（50本→190本）・サーバー会員（別案件）
