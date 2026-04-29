# ダッシュボード

## 概要

フレームワークなしのHTTPサーバー (node:http)。SQLiteから読み取った取引データをJSON/HTMLで提供。

## 起動

```bash
node packages/dashboard/dist/index.js
```

- ポート: `DASHBOARD_PORT` 環境変数 (デフォルト: 3000)
- DBパス: `DB_PATH` 環境変数 (デフォルト: ./data/trade.db)

## API エンドポイント

### GET /

インラインHTMLダッシュボード。ダークテーマ (`#0a0a0a` 背景、`#00ff88` アクセント)。

JavaScriptが5秒間隔で `/api/status` をポーリングし、以下を表示:
- サマリーグリッド: Total P&L, Win Rate, Total Trades, Active Agents
- テーブル: 最新50件の取引履歴

### GET /health

```json
{
  "status": "ok",
  "timestamp": "2026-04-29T00:00:00.000Z",
  "db": "connected",
  "uptime_seconds": 3600
}
```

### GET /api/status

```json
{
  "total_pnl": 150.5,
  "win_rate": 65.0,
  "total_trades": 100,
  "active_agents": 5,
  "total_agents": 8,
  "trades": [ /* 最新50件 */ ]
}
```

### GET /api/pnl

```json
{
  "total_pnl": 150.5,
  "win_rate": 65.0,
  "total_trades": 100,
  "winning_trades": 65,
  "losing_trades": 35
}
```

### GET /api/agents

```json
[
  { "name": "arb-scanner", "status": "running", "trade_count": 20, "pnl": 50.0 },
  { "name": "copy-trader", "status": "idle", "trade_count": 0, "pnl": 0 }
]
]
```

## データ集計ロジック

```
1. 8エージェントそれぞれ getTradesByAgent() を呼び出し
2. 全結果を結合 → timestamp降順ソート → 上位50件
3. totalPnl = pnlの合計 (exit_price非nullの取引のみ)
4. win_rate = (pnl > 0の取引数 / closed取引数) × 100
5. active_agents = ユニークなエージェント名の数
```

## エージェント状態推定

ダッシュボードはorchestratorプロセスと通信せず、DBの取引有無から状態を推定:

- 取引あり → `"running"`
- 取引なし → `"idle"`

これはヒューリスティクスであり、実際のエージェント状態とは異なる場合がある。

## セキュリティヘッダー

全レスポンスに以下を適用:

```
Content-Security-Policy: default-src 'self' 'unsafe-inline'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
```

## エラーハンドリング

- DB未初期化時: APIエンドポイントは `503 { error: 'Database not initialized' }` を返す
- 存在しないAPIルート: `404 { error: 'Not found' }`
