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

### 求人を実データ化する
正規提携（API/CSV提供/掲載契約）のみ。`jobs` の `isDemo` を外すのは正規ソース接続後。
実求人には雇用形態・賃金・業務内容・受動喫煙対策等の必須項目と掲載期限を設定する。
JobPosting 構造化データは build.mjs が「実求人・期限内」のみに出力する設計（現状は全デモ＝出力ゼロ）。

### 年収データを載せる
e-Stat（賃金構造基本統計調査）等から数値を取得し、`tools/data/salary-template.csv` の列形式で
CSV を作成 → `node tools/import-salary-csv.mjs <path.csv>` → seed→v バンプ→build。
出典3列（sourceName/sourceUrl/sourceDate）の無い行・不明slug・異常値は自動で拒否される。
**出典のない数値・推定値は登録しない**（データが入ると職種ページ・年収DBに出典つき表で自動表示）。

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
