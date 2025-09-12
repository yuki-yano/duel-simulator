# Sentry セットアップガイド

このプロジェクトでは、エラー監視とパフォーマンス監視のために [Sentry](https://sentry.io) を使用しています。

## 必要な設定

### 1. Sentryアカウントの作成

1. [Sentry](https://sentry.io) でアカウントを作成（無料枠で月5,000エラーまで利用可能）
2. 組織（Organization）を作成
3. プロジェクトを2つ作成：
   - フロントエンド用: `duel-simulator-frontend` (JavaScript/React)
   - バックエンド用: `duel-simulator-backend` (JavaScript/Node.js)

### 2. DSNの取得

各プロジェクトのSettings → Client Keys (DSN) から DSN を取得

### 3. 環境変数の設定

#### ローカル開発環境

`.env` ファイルを作成して以下を設定：

```bash
# フロントエンド用
VITE_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
VITE_SENTRY_ENVIRONMENT=development
VITE_APP_VERSION=1.0.0

# ソースマップアップロード用
SENTRY_AUTH_TOKEN=sntrys_xxx
SENTRY_ORG=your-org-name
SENTRY_PROJECT=duel-simulator-frontend
```

#### 本番環境（Cloudflare Pages）

##### フロントエンド環境変数

Cloudflare Pages のダッシュボードで設定：
- Settings → Environment variables
- 以下の変数を追加：
  - `VITE_SENTRY_DSN`
  - `VITE_SENTRY_ENVIRONMENT` (値: `production`)
  - `VITE_APP_VERSION`

##### バックエンド環境変数（Cloudflare Workers）

Wrangler CLIを使用してシークレットを設定：

```bash
# バックエンド用DSN
wrangler pages secret put SENTRY_DSN_BACKEND
# プロンプトでDSNを入力

# アプリケーションバージョン
wrangler pages secret put APP_VERSION
# プロンプトでバージョンを入力
```

### 4. Auth Tokenの作成（ソースマップアップロード用）

1. [Sentry Auth Tokens](https://sentry.io/settings/auth-tokens/) にアクセス
2. 新しいトークンを作成
3. 必要な権限を選択：
   - `project:releases` - リリース管理
   - `org:read` - 組織情報の読み取り

### 5. ソースマップのアップロード

本番ビルド時に自動的にソースマップがアップロードされるように設定済みです。

```bash
# 本番ビルド（ソースマップ付き）
pnpm build
```

### 6. デプロイ

```bash
# Cloudflare Pagesへデプロイ
pnpm deploy
```

## エラー監視の使い方

### フロントエンド

```typescript
import { captureException, captureMessage } from "@/client/lib/sentry"

// エラーを手動で報告
try {
  // 処理
} catch (error) {
  captureException(error, {
    context: { userId: "123", action: "cardMove" }
  })
}

// メッセージを報告
captureMessage("重要なイベントが発生", "info")
```

### バックエンド

Cloudflare WorkersではToucan.jsを使用して自動的にエラーがキャプチャされます。

## トラブルシューティング

### エラーが送信されない場合

1. 環境変数が正しく設定されているか確認
2. ブラウザのコンソールで `Sentry: Initialized` が表示されているか確認
3. ネットワークタブで Sentry へのリクエストがブロックされていないか確認

### ソースマップが機能しない場合

1. `SENTRY_AUTH_TOKEN` が正しく設定されているか確認
2. ビルド時に `Uploading source maps to Sentry` が表示されているか確認
3. Sentry のプロジェクト設定でリリースが作成されているか確認

## 動作確認

### フロントエンドのテスト

ブラウザのコンソールで以下を実行：

```javascript
// エラーを手動で発生させる
throw new Error("Sentry test error")
```

### バックエンドのテスト

APIエンドポイントにテストエラーを追加：

```typescript
// src/server/routes/health.ts などに追加
app.get("/api/test-error", (c) => {
  throw new Error("Sentry backend test error")
})
```

## 無料枠の制限

- 月間5,000エラーまで
- 10,000トランザクション/月
- 30日間のデータ保持

制限を超えそうな場合は、エラーのサンプリングレートを調整してください：

```typescript
// src/client/lib/sentry.ts
tracesSampleRate: 0.1, // 10%のトランザクションのみ送信
```