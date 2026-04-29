# 設定・リスク管理

## 設定ファイル

### config/default.yaml

```yaml
orchestrator:
  max_concurrent_agents: 8       # 最大同時実行エージェント数
  signal_timeout_ms: 5000        # シグナルタイムアウト
  heartbeat_interval_ms: 10000   # ハートビート間隔

risk:
  max_total_exposure_usd: 5000   # 最大総エクスポージャー
  max_single_trade_usd: 500      # 単一取引上限
  max_drawdown_pct: 10           # 最大ドローダウン%
  circuit_breaker_loss_usd: 200  # サーキットブレーカー発動損失
  daily_loss_limit_usd: 300      # 日次損失限度

simulation:
  enabled: true                  # シミュレーションモード
  slippage_pct: 0.5              # スリッページ%
  fee_pct: 0.3                   # 手数料%

agents:
  arb-scanner:
    interval_ms: 5000
    min_profit_usd: 5
    chains: [solana, bsc]
  pump-sniper:
    interval_ms: 3000
    max_position_usd: 200
    max_open_positions: 3
  spread-farmer:
    interval_ms: 5000
    min_spread_pct: 2
    max_positions: 10
  whale-tracker:
    interval_ms: 10000
    min_whale_usd: 10000
  copy-trader:
    interval_ms: 2000
    max_copy_usd: 300
    copy_delay_ms: 2000
  news-edge:
    interval_ms: 30000
    sentiment_threshold: 0.7
  liquidity-hunter:
    interval_ms: 10000
    min_liquidity_change_pct: 5
  portfolio-guard:
    interval_ms: 15000
    stop_loss_pct: 8
    rebalance_threshold_pct: 5
```

## 環境変数

### API キー

| 変数名 | 用途 | 必須 |
|--------|------|------|
| `HELIUS_RPC_URL` | Helius Solana RPC | ライブ時 |
| `DUNE_API_KEY` | Dune Analytics API | いいえ |
| `CMC_API_KEY` | CoinMarketCap API | news-edge使用時 |
| `COINGECKO_API_KEY` | CoinGecko API | いいえ |
| `GITHUB_TOKEN` | GitHub API | いいえ |
| `ONEINCH_API_KEY` | 1inch DEX API | いいえ |
| `POLYMARKET_API_KEY` | Polymarket API | いいえ |
| `PHANTOM_PRIVATE_KEY` | Phantom署名用 | いいえ |
| `POLYMARKET_PRIVATE_KEY` | Polymarket署名用 | いいえ |

### エージェント設定

| 変数名 | デフォルト | 対象エージェント |
|--------|----------|----------------|
| `ARB_MIN_PROFIT_USD` | 0.5 | arb-scanner |
| `ARB_CHAINS` | solana | arb-scanner |
| `PUMP_MAX_POSITION_USD` | 3 | pump-sniper |
| `PUMP_MAX_POSITIONS` | 3 | pump-sniper |
| `SPREAD_MIN_PCT` | 2 | spread-farmer |
| `SPREAD_MAX_POSITIONS` | 10 | spread-farmer |
| `WHALE_MIN_USD` | 1000 | whale-tracker |
| `WHALE_WATCH_ADDRESSES` | (なし) | whale-tracker |
| `COPY_MAX_USD` | 2 | copy-trader |
| `COPY_DELAY_MS` | 2000 | copy-trader |
| `NEWS_SENTIMENT_THRESHOLD` | 0.7 | news-edge |
| `LP_MIN_CHANGE_PCT` | 5 | liquidity-hunter |
| `GUARD_STOP_LOSS_PCT` | 5 | portfolio-guard |
| `GUARD_REBALANCE_PCT` | 5 | portfolio-guard |

### システム設定

| 変数名 | デフォルト | 説明 |
|--------|----------|------|
| `SIMULATION` | true | シミュレーションモード |
| `REDIS_URL` | redis://localhost:6379 | Redis接続URL |
| `DB_PATH` | ./data/trade.db | SQLiteファイルパス |
| `WALLET_ADDRESS` | (なし) | ウォレットアドレス (設定時WalletManager有効化) |
| `DASHBOARD_PORT` | 3000 | ダッシュボードポート |

## リスク管理

### 設定階層

リスクパラメータは2箇所で定義:

1. **config/default.yaml** (本番想定): より高い閾値
2. **.env.example** (開発用): より保守的な閾値

| パラメータ | YAML | .env.example |
|-----------|------|-------------|
| max_total_exposure | $5,000 | $15 |
| max_single_trade | $500 | $2 |
| circuit_breaker | $200 | $5 |
| daily_loss_limit | $300 | (なし) |

### RiskManager (MCP risk-manager)

インメモリのリスク管理サーバー:

```
取引リクエスト → check_trade()
  ├─ サーキットブレーカー中? → 拒否
  ├─ 単一取引上限超過? → 拒否
  ├─ 総エクスポージャー超過? → 拒否
  └─ OK → 承認

取引完了 → record_trade_result(pnl)
  ├─ dailyPnl += pnl
  ├─ dailyPnl < -circuit_breaker? → サーキットブレーカー発動
  └─ dailyPnl < -daily_loss_limit? → サーキットブレーカー発動
```

### BaseAgent サーキットブレーカー

各エージェントに独立したエラーサーキットブレーカー:
- 連続3回 `tick()` エラー → 警告ログ出力
- タイマーは停止せず、リトライ継続

## SimulationEngine

シミュレーションモードで全エージェントにダミーデータを提供:

| メソッド | 生成データ |
|---------|----------|
| `generateArbPrices()` | ランダムCEX/DEX価格ペア |
| `generateNewToken()` | ランダムトークン情報 |
| `generateWhaleTx()` | ランダムクジラ取引 |
| `generateOrderbook()` | ランダムbid/askオーダーブック |
| `generatePortfolioState()` | ランダムポジション一覧 |
| `generateSentimentData()` | ランダムセンチメントスコア |
| `generateLiquidityData()` | ランダム流動性データ |

## WalletManager

ライブモードで実際のブロックチェーン操作:

```typescript
class WalletManager {
  getBalance(): Promise<WalletBalance>      // SOL + SPL残高
  executeTrade(req): Promise<TradeResult>   // Jupiter経由スワップ実行
  syncState(): void                         // DBにウォレット状態保存
}
```

- Phantom MCP → 残高取得・トランザクション送信
- Jupiter MCP → スワップクォート取得
- 対象チェーン: Solanaのみ
