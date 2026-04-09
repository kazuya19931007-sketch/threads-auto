# Threads 自動運用ツール — セットアップ手順

固定費削減サービス（格安SIM・電気代・共済）の投稿を  
**毎日 7:30 / 12:30 / 22:00 に自動投稿**するシステムです。  
GitHub Actions を使うため **サーバー不要・無料** で動きます。

---

## 全体の仕組み

```
毎週日曜 21:00  週次分析ワークフロー起動
                 └─ 過去の投稿インサイトを取得
                 └─ Claude AI が分析 → analysis.json 保存

毎週日曜 22:00  週次生成ワークフロー起動
                 └─ 分析結果を踏まえて Claude AI が来週分 21 本生成
                 └─ posts.json に保存（Gitにコミット）

毎日 07:30      朝のワークフロー起動 → posts.json から当日 07:30 の投稿を送信
毎日 12:30      昼のワークフロー起動 → posts.json から当日 12:30 の投稿を送信
毎日 22:00      夜のワークフロー起動 → posts.json から当日 22:00 の投稿を送信
```

---

## セットアップ手順（30分でできます）

### ステップ 1 — GitHub リポジトリを作成

1. [github.com](https://github.com) にサインイン（無料アカウントで OK）
2. 右上「＋」→「New repository」
3. Repository name: `threads-auto`
4. **Private** を選択（トークンを保護するため）
5. 「Create repository」をクリック

---

### ステップ 2 — このフォルダをアップロード

ダウンロードした `threads-auto` フォルダの中身をそのまま  
GitHub リポジトリにアップロードしてください。

**方法A（簡単）: GitHub のWeb画面**
1. リポジトリのページで「uploading an existing file」をクリック
2. フォルダ内のファイルをドラッグ＆ドロップ
3. 「Commit changes」で保存

**方法B: Git コマンド**
```bash
cd threads-auto
git init
git remote add origin https://github.com/あなたのID/threads-auto.git
git add .
git commit -m "initial commit"
git push -u origin main
```

---

### ステップ 3 — Threads API の設定

#### 3-1. Meta Developer アカウント作成
[developers.facebook.com](https://developers.facebook.com) にアクセスし、  
「はじめる」からアカウントを作成します。

#### 3-2. アプリを作成
1. 「アプリを作成」をクリック
2. アプリタイプ:「その他」→「ビジネス」
3. アプリ名: 任意（例: threads-auto）

#### 3-3. Threads API を有効化
1. アプリのダッシュボードで「製品を追加」
2. 「Threads API」を見つけて「設定」
3. 必要な権限を追加:
   - `threads_basic`
   - `threads_content_publish`
   - `threads_read_engagement`

#### 3-4. アクセストークンとユーザー ID を取得
1. 「ツール」→「Graph API エクスプローラー」
2. アプリを選択し「アクセストークンを生成」
3. 「長期アクセストークン」に変換（有効期限 60 日）
4. `me?fields=id` を実行して ユーザー ID（数字）をメモ

---

### ステップ 4 — GitHub Secrets に登録

リポジトリの `Settings` → `Secrets and variables` → `Actions` →  
「New repository secret」で以下を登録してください:

| シークレット名 | 内容 |
|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) で取得したAPIキー |
| `THREADS_USER_ID` | ステップ3-4で取得した数字のID |
| `THREADS_ACCESS_TOKEN` | ステップ3-4で取得したアクセストークン |
| `GH_PAT` | GitHub Personal Access Token（下記参照） |

**GH_PAT の作り方:**
1. GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. 「Generate new token」
3. Repository access: このリポジトリのみ
4. Permissions: `Contents` を Read and Write に設定
5. 生成されたトークンをコピーして `GH_PAT` に貼り付け

---

### ステップ 5 — 初回の投稿を手動生成

1. リポジトリの「Actions」タブを開く
2. 「週次 — 1週間分の投稿を自動生成」を選択
3. 「Run workflow」→「Run workflow」をクリック
4. 数分で `data/posts.json` に 21 本の投稿が生成されます

これで設定完了です！あとは何もしなくても  
毎日 3 回、毎週自動で投稿・分析・改善が続きます。

---

## 投稿の確認・修正方法

`data/posts.json` を GitHub 上で直接編集できます。  
投稿内容を変えたい場合はこのファイルの `content` を書き換えてください。

---

## よくある質問

**Q: 無料で使えますか？**  
A: GitHub Actions は月 2,000 分まで無料（このツールは月約 200 分程度）。  
   Anthropic API は有料ですが、月数百円程度です。

**Q: アクセストークンの期限が切れたら？**  
A: 60 日ごとに更新が必要です。GitHub Secrets の `THREADS_ACCESS_TOKEN` を更新してください。

**Q: 投稿を止めたい場合は？**  
A: Actions タブで各ワークフローを「Disable workflow」すれば停止できます。

---

## ファイル構成

```
threads-auto/
├── .github/
│   └── workflows/
│       ├── post-morning.yml     # 07:30 投稿
│       ├── post-noon.yml        # 12:30 投稿
│       ├── post-night.yml       # 22:00 投稿
│       ├── weekly-generate.yml  # 週次投稿生成
│       └── weekly-analyze.yml   # 週次AI分析
├── scripts/
│   ├── post.js      # Threads投稿スクリプト
│   ├── generate.js  # AI投稿生成スクリプト
│   └── analyze.js   # インサイト取得・AI分析スクリプト
├── data/
│   ├── posts.json    # 投稿データ（自動更新）
│   └── analysis.json # AI分析結果（自動更新）
├── package.json
└── README.md
```
