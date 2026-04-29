# データベーススキーマ

## 概要

SQLite (better-sqlite3) を使用。WALモードで運用。全書込操作は同期API。

## テーブル定義

### trade_log - 取引履歴

| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | TEXT PK | UUID |
| `agent` | TEXT | 実行エージェント名 |
| `pair` | TEXT | 通貨ペア (例: "SOL/USDC") |
| `side` | TEXT | "buy" / "sell" |
| `entry_price` | REAL | エントリー価格 |
| `exit_price` | REAL | 決済価格 (NULL許容) |
| `quantity` | REAL | 取引数量 |
| `pnl` | REAL | 損益 (NULL許容) |
| `fee` | REAL | 手数料 |
| `chain` | TEXT | ブロックチェーン (例: "solana") |
| `tx_hash` | TEXT | トランザクションハッシュ (NULL許容) |
| `simulated` | INTEGER | シミュレーション取引フラグ (0/1) |
| `timestamp` | TEXT | ISO 8601 |

### signal_log - シグナル履歴

| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | TEXT PK | UUID |
| `source_agent` | TEXT | 発信エージェント名 |
| `signal_type` | TEXT | シグナル種別 (8種のいずれか) |
| `data_json` | TEXT | ペイロード (JSON文字列) |
| `confidence` | REAL | 信頼度 (0-1) |
| `consumed_by` | TEXT | 消費エージェント (未使用) |
| `timestamp` | TEXT | ISO 8601 |

### agent_state - エージェント状態

| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | TEXT PK | UUID |
| `agent_name` | TEXT UNIQUE | エージェント名 |
| `status` | TEXT | "idle" / "running" / "error" / "stopped" |
| `config_json` | TEXT | 設定 (JSON文字列) |
| `last_heartbeat` | TEXT | 最終ハートビート (ISO 8601, NULL許容) |
| `total_pnl` | REAL | 累計損益 |
| `trade_count` | INTEGER | 累計取引回数 |

### risk_state - リスク状態

| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | TEXT PK | "risk-{metric}" 形式の合成ID |
| `metric` | TEXT | メトリック名 |
| `value` | REAL | 現在値 |
| `threshold` | REAL | 閾値 |
| `breached` | INTEGER | 閾値超過フラグ (0/1) |
| `timestamp` | TEXT | ISO 8601 |

### wallet_state - ウォレット状態

| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | TEXT PK | UUID |
| `chain` | TEXT | ブロックチェーン |
| `address` | TEXT | ウォレットアドレス |
| `balance_json` | TEXT | 残高情報 (JSON文字列) |
| `updated_at` | TEXT | 最終更新 (ISO 8601) |

## CRUD メソッド

### Database クラス

```typescript
// 初期化
initialize(): void  // 全テーブルCREATE IF NOT EXISTS

// 取引
insertTrade(trade: TradeLog): void
getTradesByAgent(agent: string): TradeLog[]
getAgentPnl(agent: string): number

// シグナル
insertSignal(signal: Signal): void
getSignalsByType(type: string): Signal[]

// エージェント状態
upsertAgentState(agent: AgentState): void
getAgentState(name: string): AgentState | undefined

// リスク状態
upsertRiskState(state: RiskState): void
getRiskStates(): RiskState[]

// ウォレット状態
upsertWalletState(state: WalletState): void
getWalletState(chain: string): WalletState | undefined

close(): void
```

## データアクセスパターン

### 書込側 (Orchestrator + Agents)
```
Agent.tick()
  ├─ this.db.insertTrade()     → trade_log
  ├─ this.publishSignal()
  │    ├─ this.db.insertSignal()  → signal_log
  │    └─ this.signalBus.publish()
  └─ this.db.upsertAgentState() → agent_state
```

### 読取側 (Dashboard)
```
Dashboard HTTP Handler
  ├─ db.getTradesByAgent() × 8 → 全エージェントの取引を結合
  │    ├─ totalPnl集計
  │    ├─ win_rate計算
  │    └─ 最新50件ソート
  └─ (agent_state読取なし)
```

## 制限事項

1. **インデックスなし**: 主キーとagent_nameのUNIQUE以外にインデックスなし。大量データ時のクエリ性能に懸念。
2. **consumed_by未使用**: signal_log.consumed_by列への読み書きなし。
3. **単一ファイル共有**: orchestratorとdashboardが同じSQLiteファイルをボリュームマウントで共有。
4. **同期APIのみ**: better-sqlite3の同期APIを全面的に使用。高負荷時はボトルネックの可能性。
5. **テスト**: `:memory:` データベースを使用。
