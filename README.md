# rare-item-radar

**サイト: https://momentouhu.github.io/rare-item-radar/**

トレカの再販・予約開始・在庫復活や、変わり種の商品を自動で見張って、
**サイト** と **X の投稿文** を生成するレーダー。

サーバー不要。GitHub Actions が30分ごとに回り、GitHub Pages がサイトを配信する。
public リポジトリなら **運用コストは 0 円**。

---

## 仕組み

```
GitHub Actions (30分ごと)
   ↓
1. 楽天 / Yahoo などの商品APIを叩く      src/sources/
2. 前回との差分を検知（新着・在庫復活・値下げ）  src/lib/detect.js
3. X用の投稿文を生成                      src/lib/compose.js
4. サイトを生成して docs/ にコミット        src/build.js
5. Threads/Bluesky/Discord/X へ配信        src/notify/
```

- **速報ページ** `docs/index.html` … 検知した商品の一覧
- **投稿キュー** `docs/queue.html` … スマホで「Xで開く」を押すだけで投稿できる画面
- `feed.json` / `rss.xml` も吐くので、IFTTT などに繋ぐこともできる

---

## セットアップ（スマホからでも15分）

### 1. 楽天のAPIキーを取る（必須・無料・審査なし）

1. [楽天ウェブサービス](https://webservice.rakuten.co.jp/) で「アプリID発行」
2. アプリ名とURL（このリポジトリのPages URLでOK）を入れると即発行される
3. **applicationId** をメモ

### 2. 楽天アフィリエイトIDを取る（収益化する場合）

1. [楽天アフィリエイト](https://affiliate.rakuten.co.jp/) に楽天IDでログイン
2. 「アフィリエイトID」を確認（`1a2b3c4d.5e6f7g8h.…` 形式）
3. これを設定すると、APIが返すリンクが自動でアフィリエイトリンクになる

### 3. GitHub Secrets に登録

リポジトリの **Settings → Secrets and variables → Actions → New repository secret**

| 名前 | 必須 | 中身 |
|---|---|---|
| `RAKUTEN_APP_ID` | ✅ | 楽天のアプリID |
| `RAKUTEN_AFFILIATE_ID` | 任意 | 楽天アフィリエイトID |
| `YAHOO_CLIENT_ID` | 任意 | [Yahoo!デベロッパー](https://e.developer.yahoo.co.jp/dashboard/) のClient ID |
| `VC_SID` | 任意 | バリューコマースのsid（Yahoo商品のアフィリンク化に必要） |
| Threads / Bluesky / Discord / X | 任意 | 配信先ごとのキー（後述。**まずは不要**） |

### 4. GitHub Pages を有効化

**Settings → Pages → Source: Deploy from a branch → Branch: `main` / `/docs`**

### 5. 初回実行

**Actions → crawl → Run workflow**

> 初回はスナップショットを作るだけで、投稿イベントは出ない（全商品が「新着」になってしまうのを防ぐため）。
> 2回目以降から差分が出る。

---

## 配信先の選択（コストの話）

**Xだけが有料**。他はほぼ全部タダなので、Xに固執する必要はない。

| 配信先 | 料金 | リンク投稿 | 上限 | 日本での強さ |
|---|---|---|---|---|
| **Threads** | **無料** | ✅ | 250投稿/24h | ◎ ユーザー数が多い。X代替の本命 |
| **Bluesky** | **無料** | ✅ | 実質1,666投稿/時 | ○ 母数は小さいがオタク/トレカ層は濃い |
| **Discord Webhook** | **無料** | ✅ | 実質無制限 | ◎ 速報と相性最良。既存コミュニティに刺さる |
| RSS / JSON | **無料** | ✅ | — | △ 濃いユーザーが拾う。生成済み |
| **X** | **$0.20/リンク付き投稿** | 💰 | 予算次第 | ◎ 集客力は最強。だが高い |
| LINE公式 | ❌ 構造的に不可 | — | — | 後述 |

実装済みで、Secretsを入れた配信先だけが自動で有効になる。

### なぜ X が高いのか

2026年2月6日から X API は **従量課金（クレジット前払い、最低$5チャージ）** になり、新規開発者向けの無料枠は廃止された。
さらに 2026年4月16日から **URL付き投稿だけ単価が跳ね上がっている**。

| 操作 | 単価 |
|---|---|
| 通常の投稿 | $0.01〜0.015 |
| **URL付きの投稿** | **$0.20** |
| 旧Basic ($200/月) / 旧Pro ($5,000/月) | 既存契約者のみ・新規申込不可 |

商品通知は全投稿にリンクが付くので直撃する。リンク付き自動投稿を1日10件やると **約¥9,000/月**。

### なぜ LINE は無理なのか

LINE公式アカウントは **「配信人数 × 通数」** で課金される。
フォロワー1,000人に1通配信 = 1,000通の消費。

- 無料プラン: 月200通 → **フォロワー200人に1回配信したら終わり**
- スタンダード(月15,000円): 30,000通 → 1,000人に1日1通で30日でちょうど枯渇
- 1,000人に1日10通なら月30万通。追加分だけで**数十万円**

速報系＝高頻度配信とは根本的に相性が悪い。使うならプッシュ配信ではなく、リッチメニューからサイトへ誘導する形（配信0通）に限る。

### PWA / Web Push は？

Web Push (VAPID) 自体は無料。ただし **購読者リストを保存する場所** が別途要る（public リポジトリには置けない）ので、
Cloudflare KV などを足す必要がある。さらに iOS は「ホーム画面に追加したPWA」でしか通知を受け取れず、
ユーザー側のハードルが高い。**フォロワーが付いてからの Phase 2** が妥当。

### 推奨する始め方

1. **Threads + Bluesky + Discord を自動配信**（月0円）
2. **X は `docs/queue.html` から手動投稿**（月0円）— 集客力が一番高いので、1日3〜5件に厳選して手で投げる
3. 収益が出てから X API の蛇口を開ける

### 設定

`config/watch.json` の `budget` が両方 `0` の間は、**X APIを一切呼ばない**。

```json
"budget": {
  "maxLinkPostsPerDay": 0,    // X: リンク付き投稿の1日上限（$0.20/件）
  "maxPlainPostsPerDay": 0,   // X: リンクなし投稿の1日上限（$0.015/件）
  "monthlyUsdCap": 5          // X: 月間の絶対上限。超えたら自動停止
}
```

`data/spend.json` に推定コストが積算され、上限に達すると投稿を止める。Threads/Bluesky/Discord はこの制限を受けない。

### 各配信先の Secrets

| 配信先 | Secrets | 取得先 |
|---|---|---|
| Threads | `THREADS_USER_ID`, `THREADS_ACCESS_TOKEN` | [Meta for Developers](https://developers.facebook.com/) でアプリ作成 → Threads API を追加 |
| Bluesky | `BLUESKY_IDENTIFIER`, `BLUESKY_APP_PASSWORD` | Bluesky アプリ内 Settings → App Passwords（**本パスワードは使わない**） |
| Discord | `DISCORD_WEBHOOK_URL` | サーバー設定 → 連携サービス → ウェブフック（1分で終わる） |
| X | `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET` | [X Developer Portal](https://developer.x.com/) で **Read and write** 権限に設定 |

一番簡単なのは Discord（Webhook作るだけ）、一番効くのは Threads。

---

## リアルタイム化（Cloudflare Worker）

GitHub Actions の cron は最短5分だが、実際には大幅に遅延する。
**このリポジトリの実測値: 30分設定に対して平均125分・最大223分**（19回分の計測）。
在庫復活の速報にはまったく使えない。
1分間隔で回すために Cloudflare Worker を同梱している（`worker/`）。**無料枠のみで動く。**

### 一番の制約は楽天API側

| 制約 | 数字 |
|---|---|
| 楽天API（無料版） | **1日5,000リクエスト**・1秒1リクエスト |
| Cloudflare Workers cron | 最短1分・無料枠 100,000リクエスト/日 |
| Cloudflare D1（無料） | 5GB・500万読み書き/月 |

1日5,000 ÷ 1,440分 = **毎分叩けるのは実質3クエリまで**。
全部を毎分監視することはできないので、監視対象を階層に分ける。

| 階層 | 間隔 | 用途 |
|---|---|---|
| `realtime` | **1分** | 激戦枠。楽天クエリ2本まで |
| `fast` | 10分 | 主力ジャンル |
| `normal` | 60分 | 広く浅く |

`pollOffset` で監視ごとに実行する分をずらし、1分あたりの負荷を平らにしている。

```bash
npm run budget   # 消費見込みを検算する（上限超過なら異常終了）
```

現在の設定は **1日4,680リクエスト**（上限5,000、余裕320）。キーワードを足すときは必ずこれを回すこと。

### 実際の遅延

| 経路 | 検知 | 配信 | 合計 |
|---|---|---|---|
| Cloudflare Worker → Discord | 〜60秒 | 1〜3秒 | **〜1分** |
| Cloudflare Worker → Threads/Bluesky | 〜60秒 | 数秒＋タイムライン次第 | 〜1分＋α |
| GitHub Actions → 手動X投稿 | **実測 平均125分** | 手動 | 2時間〜 |

**Discord Webhook が最速**。スマホのロック画面にプッシュ通知が直接鳴るので、
SNSのタイムラインを見に行く必要がない。速報の主力はこれ。

### それでも勝てない相手がいる

転売業者のbotは専用サーバーで秒単位のポーリング、ショップ個別の在庫エンドポイント監視、
カート投入の自動化まで揃えている。**本当に瞬殺される商品は1分でも間に合わない。**

勝負になるのは、
- **予約開始**（数時間〜数日は在庫が残る）
- **再販**（数十分残ることが多い）
- **値下げ**（急がない）

速度そのものより「予約開始の事前告知」「発売日カレンダー」「まだ買える在庫の網羅」に価値を寄せるほうが筋がいい。

### デプロイ手順

```bash
cd worker
npx wrangler d1 create radar          # 出力された database_id を wrangler.toml に貼る
npx wrangler d1 execute radar --file=schema.sql --remote
npx wrangler secret put RAKUTEN_APP_ID
npx wrangler secret put RAKUTEN_AFFILIATE_ID
npx wrangler secret put DISCORD_WEBHOOK_URL
npx wrangler deploy
```

**スマホから運用したい場合**は、Cloudflareダッシュボードの **Workers & Pages → Create → Connect to Git** でこのリポジトリを繋ぎ、
**Root directory を `worker`** に設定する。以降は push するだけで自動デプロイされる。
D1の作成とSecretsの登録はダッシュボードからでもできる。

デプロイしたら、リポジトリの **Settings → Secrets and variables → Actions → Variables** に
`WORKER_EVENTS_URL`（例: `https://rare-item-radar.<subdomain>.workers.dev`）を登録する。
これが設定されると Actions 側は商品APIを叩かず、Worker が検知したイベントを取り込むだけになる
（楽天の日次上限を二重に消費しないため）。

### 動作確認

```
GET /health        監視中の件数・最終クロール時刻・階層の割り当て
GET /events.json   直近のイベント（Actionsがサイト生成に使う）
```

---

## 監視対象を変える

`config/watch.json` の `watches` を編集するだけ。スマホのGitHubアプリからでも直接編集できる。

```json
{
  "id": "yugioh",
  "label": "遊戯王",
  "emoji": "🃏",
  "keywords": ["遊戯王 BOX 予約", "遊戯王OCG デュエルモンスターズ BOX"],
  "sources": ["rakuten_ichiba", "rakuten_books"],
  "filters": {
    "minPrice": 2000,
    "maxPrice": 80000,
    "excludeWords": ["オリパ", "シングル", "代行"]
  }
}
```

`excludeWords` が効くかどうかで精度が決まる。運用しながら足していくのが前提。

---

## ショップ対応表

「希少商品が売られるサイトは全部カバーする」方針。ただし**楽天・Yahoo以外は公式APIが無い＝スクレイピング**なので、
サイトごとに「取れるか」「規約上どうか」「アフィリエイトがあるか」が全く違う。**2026-09-11 に実機で全サイト確認した結果**が以下。

### 対応済み（動作確認済み）

| ショップ | 取得方法 | 間隔 | robots.txt | アフィリエイト | 備考 |
|---|---|---|---|---|---|
| 楽天市場 / 楽天ブックス | **公式API** | 1秒1req・**日5,000** | — | 楽天アフィリエイト 2〜4% | Worker でリアルタイム可 |
| Yahoo!ショッピング | **公式API** | — | — | バリューコマース | Worker でリアルタイム可 |
| **駿河屋** | HTML | **30秒**（robots.txt の Crawl-delay） | `*` は Allow / AIクローラは拒否 | 自社プログラムあり | 中古価格帯を取得。画像は `photo.php?shinaban=ID` |
| **セブンネット** | HTML（`data-gtm-criteo-view` のJSON） | 10秒 | 制限なし | バリューコマースのみ **1.1%** | カートボタン `disabled` で在庫判定。一番きれいに取れる |
| **タワレコ** | HTML | 10秒 | `/search/item/` は許可 | バリューコマース | 1ページ約800KBと重い |
| **ホビーサーチ** | HTML | 10秒 | 制限なし | 要確認 | フィギュア・プラモ。予約品/販売中/残りN が取れる |

スクレイパは **GitHub Actions でのみ動く**（Cloudflare Worker はAPIソースだけ）。
有効/無効は `config/watch.json` の `scrapers.enabled` で切り替える。

### 取れなかった（理由つき）

| ショップ | 状況 | 対応案 |
|---|---|---|
| **イオンネットスーパー** | Magento + reCAPTCHA。店舗選択とログインが前提で匿名検索ができない | 現実的な手段なし |
| **あみあみ** | `403` で bot 遮断 | 非公式JSON APIがあるが同じく遮断される。見送り |
| **ポケモンセンターオンライン** | 検索結果が JS 描画（HTMLに商品が無い）。そもそも抽選販売 | Cloudflare Browser Rendering（有料寄り）でなら可 |
| **トイザらス** | 完全SPA（HTML 5KB のみ） | 同上 |
| **ヨドバシ / ビックカメラ** | TCPレベルで遮断（応答なし） | 手段なし。ヨドバシはアフィリエイト自体もない |
| **Amazon** | PA-API は審査＋180日以内に3件の売上が必要 | 実績ができてから |

### スクレイパが壊れたら

サイト側の改修で黙って0件になるのが一番怖い。`data/source-health.json` に**ソースごとの連続0件回数とエラー**を記録し、
3回連続で0件になるとサイトの上部に警告帯が出る。切り分けはこれ:

```bash
npm run probe surugaya "ポケモンカード"     # 1ソース×1キーワードを実際に取って表示
```

直すときは `src/sources/<id>.js` のセレクタを実HTMLに合わせる。各ファイル冒頭に構造のメモがある。

### 追加するとき

`src/sources/` に `search(keyword, filters)` が正規化済みアイテム配列を返すモジュールを作り、
`src/sources/index.js` に並べ、この表に追記する。**必ず先に robots.txt と利用規約を確認し、Crawl-delay があればそれを最低間隔にする。**

---

## 収益の目安（正直な数字）

楽天アフィリエイトは料率2〜8%（トレカ・書籍系は概ね2%）。
トレカBOXは単価5,000〜20,000円なので **1成約あたり100〜400円**。

| 時期 | フォロワー | 月間収益の目安 |
|---|---|---|
| 1ヶ月目 | 100〜500 | ¥0〜1,500 |
| 3ヶ月目 | 1,000〜3,000 | ¥3,000〜8,000 |
| 6ヶ月目 | 3,000〜8,000 | ¥10,000〜25,000 |
| 12ヶ月目 | 10,000〜20,000 | ¥40,000〜80,000 |

これは **うまくいった場合の線**。この手の個人速報アカウントは大半が月5,000円以下で止まり、
月10万円を超えるのは上位数%。最初の3ヶ月はほぼ無収入だと思っておくのが正しい。

初期コストが実質ゼロなので、負けても失うのは時間だけ。
だからこそ、X APIに月9,000円を先に払う設計にはしていない。

---

## ローカルで動かす

```bash
export RAKUTEN_APP_ID=xxxxx
npm run crawl && npm run build
open docs/index.html
```

## 注意

- スケジュール実行は、リポジトリに60日間動きがないとGitHubに自動停止される。停止したらActionsから手動で再有効化する
- 表示している価格・在庫は取得時点のもの。サイトのフッターにアフィリエイト表記を必ず残すこと（ステマ規制対応）
