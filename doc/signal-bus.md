# シグナルバス・エージェント間通信

## SignalBus (Redis Pub/Sub)

### アーキテクチャ

```
Agent A                          Agent B
  │                                │
  ├─ publishSignal()               │
  │    ├─ DB.insertSignal()        │
  │    └─ SignalBus.publish()      │
  │         │                      │
  │         ▼                      │
  │    Redis: signal:{type} ──────► SignalBus.subscribe()
  │                                │    └─ handler → onSignal()
```

### 仕様

| 項目 | 内容 |
|------|------|
| トランスポート | Redis Pub/Sub (ioredis) |
| チャンネル命名 | `signal:{signal_type}` |
| メッセージ形式 | JSON (Signal オブジェクト) |
| 購読接続 | シグナルタイプごとに1つのRedis接続 |
| 配信保証 | At-most-once（オフライン時は喪失） |

### SignalBus クラス

```typescript
class SignalBus {
  publish(signal: Signal): Promise<void>
  subscribe(signalType: SignalType, handler: SignalHandler): SignalHandler
  unsubscribe(signalType: SignalType, handler: SignalHandler): void
  disconnect(): void
}
```

- publisher: 1つのRedis接続を共有
- subscribers: シグナルタイプごとに専用接続（Redis Pub/Subの制約による）
- ハンドラは同期実行。例外はログ出力され、他ハンドラは継続実行。

## Signal 型定義

```typescript
interface Signal {
  id: string              // UUID
  source_agent: string    // 発信エージェント名
  signal_type: SignalType // 8種類のいずれか
  data: Record<string, unknown>  // ペイロード
  confidence: number      // 信頼度 (0-1)
  timestamp: string       // ISO 8601
}
```

## SignalType 一覧

| タイプ | 意味 | 生成エージェント |
|--------|------|-----------------|
| `price_gap` | アービトラージ価格差検出 | arb-scanner |
| `new_token` | 新規トレンドトークン検出 | pump-sniper |
| `whale_move` | クジラ大型取引検出 | whale-tracker |
| `liquidity_change` | 流動性大幅変動 | liquidity-hunter |
| `sentiment_shift` | 市場センチメント変化 | news-edge |
| `spread_opportunity` | スプレッドマーケットメイク機会 | spread-farmer |
| `risk_breach` | リスク閾値超過 | portfolio-guard, pump-sniper |
| `trade_executed` | 取引実行完了 | copy-trader |

## シグナルフロー詳細

```
                    ┌── whale_move ──→ copy-trader
                    │                   │
whale-tracker ──────┤                   └── trade_executed ──→ portfolio-guard
                    │                                          │
                    └── whale_move ──→ arb-scanner              ├── risk_breach
                                        │                      │
                                        └── price_gap          └── (未接続)

news-edge ────── sentiment_shift ──→ (未接続)
liquidity-hunter ── liquidity_change ──→ (未接続)
spread-farmer ─── spread_opportunity ──→ (未接続)

pump-sniper ───── new_token ──→ pump-sniper (self-loop)
                risk_breach ──→ (未接続)
```

### 実際のシグナル消費関係

| 消費者 | 購読シグナル | 処理内容 |
|--------|------------|---------|
| arb-scanner | `whale_move` | クジラ取引をprice_gapに変換 (confidence × 0.8) |
| copy-trader | `whale_move` | クジラbuyに追随 (クジラ金額の1%、max $300) |
| portfolio-guard | `trade_executed` | 監視モードでrisk_breach通知 |
| pump-sniper | `new_token` | 新トークン評価でrisk_breach通知 |
| spread-farmer | `spread_opportunity` | 購読するがonSignal()は空実装 |

## PublishSignal フロー

```typescript
// BaseAgent.publishSignal()
1. Signal オブジェクト生成 (UUID, timestamp)
2. DB.insertSignal() → signal_log テーブルに永続化
3. SignalBus.publish() → Redis チャンネルに配信
   ※ DB失敗とBus失敗は独立 catch（片方の失敗が他方を阻害しない）
```

## 現在の制限

1. **SignalBus未配線**: CLAUDE.mdに「SignalBus integration is a pending issue」と記載。現状はpublishのみでsubscribeが動作するかは未確認。
2. **未接続シグナル**: `sentiment_shift`, `liquidity_change`, `spread_opportunity` には消費者がいない。
3. **シグナル再生なし**: Redis Pub/Subはfire-and-forget。オフライン中のシグナルは喪失。
4. **consumed_by未使用**: signal_logテーブルにconsumed_by列があるが、どのコードも読み書きしない。
5. **unsubscribe漏れ**: BaseAgent.stop() が SignalBus.unsubscribe() を呼ばない（Redis接続リーク）。
