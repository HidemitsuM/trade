# デプロイ・運用

## Docker構成

### docker-compose.yml

4サービスを定義:

```yaml
services:
  redis:        # メッセージブローカー
  orchestrator: # メインプロセス (8エージェント起動)
  dashboard:    # HTTPダッシュボード
  db-backup:    # 定期DBバックアップ
```

### サービス詳細

#### redis
- イメージ: `redis:7-alpine`
- ポート: 6379
- 永続化: `appendonly yes` + 名前付きボリューム
- ヘルスチェック: `redis-cli ping` (5s間隔, 3sタイムアウト, 5リトライ)

#### orchestrator
- ビルドターゲット: `orchestrator` (マルチステージDockerfile)
- 依存: redis (service_healthy)
- 環境変数:
  - `REDIS_URL=redis://redis:6379`
  - `DB_PATH=/app/data/trade.db`
  - `SIMULATION=true` (デフォルト)
- ボリューム: `./data:/app/data`, `./config:/app/config`
- エントリポイント: `node packages/orchestrator/dist/index.js`

#### dashboard
- ビルドターゲット: `dashboard`
- ポート: 3000
- 依存: orchestrator (順序のみ)
- ボリューム: `./data:/app/data`
- エントリポイント: `node packages/dashboard/dist/index.js`

#### db-backup
- イメージ: `alpine:3.19`
- リスタート: `unless-stopped`
- スケジュール: 60s待機後、6時間ごと
- 保持期間: 30日間
- ボリューム: `./data:/data`, `scripts/backup-db.sh:/backup-db.sh:ro`

## Dockerfile

マルチステージビルド (3ターゲット):

```
Stage 1: builder
  node:22-slim
  ├─ python3, make, g++ インストール (better-sqlite3 ネイティブビルド用)
  ├─ 全 package.json コピー
  ├─ npm install (ワークスペース全体)
  ├─ TypeScript ソースコピー
  ├─ node scripts/build.mjs (全パッケージコンパイル)
  └─ npm prune --omit=dev

Stage 2a: orchestrator
  node:22-slim (クリーン)
  ├─ node_modules, packages/, config/ をbuilderからコピー
  └─ CMD: node packages/orchestrator/dist/index.js

Stage 2b: dashboard
  node:22-slim (クリーン)
  ├─ 同上
  └─ CMD: node packages/dashboard/dist/index.js
```

## 起動順序

```
1. docker compose up
2. redis 起動 → ヘルスチェック待機
3. orchestrator 起動
   ├─ Redis接続
   ├─ SQLite初期化
   ├─ MCPサーバー子プロセス起動 (ライブモード時)
   ├─ 8エージェント起動 (順次)
   └─ ハートビート監視開始 (30s間隔)
4. dashboard 起動 (orchestrator完了後)
5. db-backup 起動
```

## グレースフルシャットダウン

orchestratorは `SIGTERM` / `SIGINT` で以下の順序でクリーンアップ:

```
1. AgentManager.stopAll()     → 全エージェント停止
2. SignalBus.disconnect()     → Redis接続切断
3. MCPConnectionPool.disconnect() → MCP子プロセス終了
4. Database.close()           → SQLite接続終了
```

## 運用スクリプト

### scripts/build.mjs

全ワークスペースパッケージを動的発見し `npx tsc` を実行:
- packages/core
- packages/orchestrator
- packages/dashboard
- packages/agents/* (8個)
- packages/mcp-servers/* (12個)

### scripts/monitor.sh

ダッシュボードAPIを60秒間隔で1時間ポーリング:
- `/api/status` → 取引数・PnL・勝率
- `/api/agents` → エージェント状態
- `monitor.log` にログ出力
- 最後にサマリテーブルを表示

### scripts/backup-db.sh

SQLiteバックアップ:
1. `PRAGMA wal_checkpoint(TRUNCATE)` → WALフラッシュ
2. SQLite `.backup` コマンドで整合性スナップショット作成
3. gzip圧縮
4. 保持期間超過のバックアップを削除

## CI/CD

### GitHub Actions (.github/workflows/ci.yml)

ビルド・テストパイプライン:
- TypeScript コンパイル (`npm run build`)
- テスト実行 (`npm test`)

## ローカル開発

```bash
# 依存インストール
npm install

# ビルド
npm run build

# テスト
npm test

# テストウォッチ
npm run test:watch

# 単一テスト
npx vitest run packages/core/__tests__/db.test.ts

# Docker起動
docker compose up --build
```

## 本番運用時の注意

1. **SIMULATION=false** に設定する前にAPIキーを全て設定
2. **WALLET_ADDRESS** を設定するとWalletManagerが有効化
3. `.env` ファイルで環境変数を管理（`.env.example` をテンプレートに）
4. Redisは永続化設定済み (`appendonly yes`)
5. DBバックアップは6時間ごと、30日保持
