# エージェント詳細

## 共通構造

全エージェントは `BaseAgent` を継承し、以下のライフサイクルを持つ:

```typescript
abstract class BaseAgent {
  abstract tick(): Promise<void>        // 定期実行 (setInterval)
  abstract onSignal(signal): Promise<void>  // シグナル受信時

  getSubscribedSignalTypes(): SignalType[]  // 購読シグナル定義
  publishSignal(type, data, confidence): Signal  // シグナル発火
}
```

サーキットブレーカー: 連続3回エラーで警告ログ出力（タイマーは停止しない）。

---

## 1. arb-scanner (アービトラージスキャナー)

**目的**: CEXとDEX間の価格差を検出し、アービトラージ機会を通知。

### 設定
| パラメータ | デフォルト | 説明 |
|-----------|----------|------|
| `interval_ms` | 3000ms | ポーリング間隔 |
| `min_profit_usd` | $5 | 最小利益閾値 |
| `chains` | solana, bsc | 対象チェーン |

### 戦略ロジック
```typescript
analyze(prices: { buyPrice, sellPrice, quantity }) {
  profit = (sellPrice - buyPrice) * quantity
  return profit >= min_profit_usd ? ArbOpportunity : null
}
```

### tick() 処理フロー
1. **シミュレーション**: `simulation.generateArbPrices()` でダミー価格取得
2. **リアル**: CoinGecko (CEX価格) + Jupiter (DEXクォート) でSOL/USDC価格取得
3. 利益が閾値以上 → `price_gap` シグナル発火 + DBにトレード記録

### シグナル
| 方向 | タイプ | タイミング |
|------|-------|-----------|
| 生成 | `price_gap` | アービトラージ機会検出時 |
| 消費 | `whale_move` | クジラ取引検知時にprice_gapに変換 |

---

## 2. copy-trader (コピートレーダー)

**目的**: クジラの取引を検知し、小規模に追随購入。

### 設定
| パラメータ | デフォルト | 説明 |
|-----------|----------|------|
| `interval_ms` | 5000ms | ポーリング間隔 |
| `max_copy_usd` | $300 | 最大コピー金額 |
| `copy_delay_ms` | 2000ms | コピー遅延 (未使用) |

### 戦略ロジック
```typescript
evaluate(signal) {
  if (signal.action !== 'buy') return { should_copy: false }
  return {
    should_copy: true,
    copy_amount_usd: min(max_copy_usd, amount_usd * 0.01)  // クジラの1%
  }
}
```

### tick() 処理フロー
- tick()は何もしない（完全シグナル駆動）

### onSignal() 処理フロー
1. `whale_move` シグナルを受信
2. Strategyで評価 → buyのみコピー
3. コピー実行 → `trade_executed` シグナル発火
4. リアルモード: CoinGecko価格でDBにトレード記録

### シグナル
| 方向 | タイプ | タイミング |
|------|-------|-----------|
| 生成 | `trade_executed` | クジラコピー取引実行時 |
| 消費 | `whale_move` | クジラ取引検知時 |

---

## 3. liquidity-hunter (流動性ハンター)

**目的**: トークンの流動性変化（24hボリューム）を監視し、大幅変動を通知。

### 設定
| パラメータ | デフォルト | 説明 |
|-----------|----------|------|
| `interval_ms` | 5000ms | ポーリング間隔 |
| `min_liquidity_change_pct` | 5% | 最小変化率閾値 |

### 戦略ロジック
```typescript
analyze(data: { previous, current }) {
  change_pct = abs(current - previous) / previous * 100
  return change_pct >= threshold ? LiquidityAlert : null
}
```

### tick() 処理フロー
1. **リアル**: ランダムにトークン選択 → CoinGecko で24hボリューム取得
2. 前回値と比較 → 閾値以上で `liquidity_change` シグナル発火

### シグナル
| 方向 | タイプ | タイミング |
|------|-------|-----------|
| 生成 | `liquidity_change` | 大幅な流動性変動検出時 |
| 消費 | なし | - |

### 制限
- リアルパスはランダムにトークンを選択（体系的スキャンではない）
- DBへのトレード記録なし

---

## 4. news-edge (ニュースエッジ)

**目的**: 市場センチメント（Fear & Greed指数）を監視し、強気シグナルでエントリー。

### 設定
| パラメータ | デフォルト | 説明 |
|-----------|----------|------|
| `interval_ms` | 60000ms | ポーリング間隔 |
| `sentiment_threshold` | 0.7 | エントリー閾値 (0-1) |

### 戦略ロジック
```typescript
evaluate(data: { sentiment_score }) {
  return sentiment_score >= threshold
    ? { should_enter: true }
    : { should_enter: false, reason: "low sentiment" }
}
```

### tick() 処理フロー
1. **リアル**: CoinMarketCap Fear & Greed Index → 0-1スコアに変換
2. ランダムにトークン選択 → 評価
3. 強気判定 → `sentiment_shift` シグナル + buyトレード記録

### シグナル
| 方向 | タイプ | タイミング |
|------|-------|-----------|
| 生成 | `sentiment_shift` | センチメントが閾値超過時 |
| 消費 | なし | - |

### 制限
- トークンがランダム選択（センチメントとトークンの相関なし）
- `fear_greed` フィールドを受理するが戦略では不使用

---

## 5. portfolio-guard (ポートフォリオガード)

**目的**: ポートフォリオのストップロス・過集中を監視し、リスク警告と売却取引を記録。

### 設定
| パラメータ | デフォルト | 説明 |
|-----------|----------|------|
| `interval_ms` | 15000ms | ポーリング間隔 |
| `stop_loss_pct` | 8% | ストップロス閾値 |
| `rebalance_threshold_pct` | 5% | リバランス閾値 |

### 戦略ロジック
```typescript
evaluate(portfolio: Position[]) {
  // 各ポジションのPnL%を計算
  // PnL <= -stop_loss_pct → ストップロス発動
  // 一ポジションの配分 > (100/N + rebalance_threshold)% → リバランス必要
  return { stop_loss_triggered, rebalance_needed, tokens_to_sell }
}
```

### tick() 処理フロー (3パス)
1. **Walletパス** (WalletManager + ライブ):
   - `wallet.getBalance()` → SOL残高 + CoinGecko価格 → ポートフォリオ構築
   - エントリー価格 = 現在価格 × 90%（推定）
2. **MCPフォールバック** (Helius + CoinGecko):
   - Helius `get_account_balance` + CoinGecko価格
3. **シミュレーション**: `simulation.generatePortfolioState()`

リスク判定 → `risk_breach` シグナル + sellトレード記録

### onSignal()
- `trade_executed` 受信 → 監視モードで `risk_breach` シグナル (confidence=1.0)

### シグナル
| 方向 | タイプ | タイミング |
|------|-------|-----------|
| 生成 | `risk_breach` | ストップロス/過集中検出時 |
| 消費 | `trade_executed`, `risk_breach` | 他エージェントの取引を監視 |

### 特記事項
- 最も複雑なエージェント（WalletManager統合、デュアルMCPパス）
- リアルポートフォリオは常に単一SOLポジションとして扱う

---

## 6. pump-sniper (パンプスナイパー)

**目的**: トレンドトークンのパンプ可能性を評価し、買いシグナルを生成。

### 設定
| パラメータ | デフォルト | 説明 |
|-----------|----------|------|
| `interval_ms` | 3000ms | ポーリング間隔 |
| `max_position_usd` | $200 | 最大ポジション (未使用) |
| `max_open_positions` | 3 | 最大ポジション数 (未使用) |

### 戦略ロジック
```typescript
evaluate(token: { liquidity, social_score, red_flags }) {
  if (red_flags.length > 0) return null     // レッドフラグあり
  if (liquidity < 5000) return null         // 流動性不足
  if (social_score < 0.5) return null       // ソーシャル不足
  return { should_buy: true }
}
```

### tick() 処理フロー
1. **リアル**: CoinGecko トレンドAPI → トレンドコイン取得
2. market_cap_rank から合成データ生成:
   - 流動性 = rank基準の推定値
   - social_score = ランキング位置基準
   - red_flags = rank > 500 なら `['no_audit']`
3. 評価通過 → `new_token` シグナル + buyトレード記録

### onSignal()
- `new_token` 受信 → `risk_breach` シグナル (`action: 'evaluating_new_token'`)

### シグナル
| 方向 | タイプ | タイミング |
|------|-------|-----------|
| 生成 | `new_token` | トレンドトークン承認時 |
| 生成 | `risk_breach` | 新トークン評価通知 |
| 消費 | `new_token` | 自身のシグナルを再処理 |

### 制限
- 流動性・ソーシャルスコアがmarket_cap_rankからの合成値
- `max_open_positions` は設定にあるが未実装

---

## 7. spread-farmer (スプレッドファーマー)

**目的**: bid/askスプレッドを監視し、マーケットメイク機会を通知。

### 設定
| パラメータ | デフォルト | 説明 |
|-----------|----------|------|
| `interval_ms` | 5000ms | ポーリング間隔 |
| `min_spread_pct` | 2% | 最小スプレッド閾値 |
| `max_positions` | 10 | 最大ポジション (未使用) |

### 戦略ロジック
```typescript
evaluate(orderbook: { bid, ask }) {
  spread_pct = (ask - bid) / (bid + ask) * 100
  return spread_pct >= min_spread_pct
    ? { should_trade: true, spread_pct }
    : null
}
```

### tick() 処理フロー
1. **リアル**: Jupiter で SOL/USDC クォート取得
2. priceImpactPct から合成 bid/ask を導出
3. スプレッド閾値超過 → `spread_opportunity` シグナル + トレード記録

### シグナル
| 方向 | タイプ | タイミング |
|------|-------|-----------|
| 生成 | `spread_opportunity` | スプレッド閾値超過時 |
| 消費 | `spread_opportunity` | onSignal()は空実装 |

### 制限
- オーダーブックがJupiterクォートからの合成値
- `max_positions` 未実装

---

## 8. whale-tracker (クジラトラッカー)

**目的**: Solana上の大型ウォレット取引を監視し、クジラムーブを通知。

### 設定
| パラメータ | デフォルト | 説明 |
|-----------|----------|------|
| `interval_ms` | 10000ms | ポーリング間隔 |
| `min_whale_usd` | $10,000 | クジラ判定閾値 |
| `watch_addresses` | (環境変数) | 監視対象アドレス |

### 戦略ロジック
```typescript
analyze(tx: { amount_usd }) {
  return amount_usd >= min_whale_usd ? WhaleAlert : null
}
```

### tick() 処理フロー (リアルモード)
1. 各監視アドレスに対して Helius `get_signatures_for_address` (最新5件)
2. 新規シグネチャ → Helius `get_transaction` で詳細取得
3. pre/post バランス差分からSOL変動量を計算
4. CoinGecko価格でUSD換算
5. 閾値以上 → `whale_move` シグナル発火
6. `lastSeenSignatures` Map で重複排除

### シグナル
| 方向 | タイプ | タイミング |
|------|-------|-----------|
| 生成 | `whale_move` | クジラ取引検出時 |
| 消費 | なし | - |

### 特記事項
- SOLのみ追跡（SPLトークン非対応）
- 監視アドレスは環境変数で設定（デフォルトなし）

---

## シグナルフロー全体図

```
whale-tracker ─(whale_move)──→ copy-trader ─(trade_executed)──→ portfolio-guard
       │
       └──(whale_move)──→ arb-scanner ─(price_gap)──→ (消费者なし)

news-edge ──(sentiment_shift)──→ (消费者なし)
liquidity-hunter ──(liquidity_change)──→ (消费者なし)
spread-farmer ──(spread_opportunity)──→ (消费者なし)
pump-sniper ──(new_token)──→ pump-sniper (self: risk_breach)
portfolio-guard ──(risk_breach)──→ (消费者なし)
```

## エージェント別サマリ

| エージェント | 間隔 | 生成シグナル | 消費シグナル | MCP | リアルAPI | DB書込 |
|-------------|------|-------------|-------------|-----|----------|--------|
| arb-scanner | 3s | `price_gap` | `whale_move` | coingecko, jupiter | CoinGecko + Jupiter | あり |
| copy-trader | 5s | `trade_executed` | `whale_move` | coingecko | CoinGecko | あり |
| liquidity-hunter | 5s | `liquidity_change` | - | coingecko | CoinGecko | なし |
| news-edge | 60s | `sentiment_shift` | - | coinmarketcap, coingecko | CMC + CoinGecko | あり |
| portfolio-guard | 15s | `risk_breach` | `trade_executed` | coingecko, helius | CoinGecko + Helius | あり |
| pump-sniper | 3s | `new_token` | `new_token` | coingecko | CoinGecko | あり |
| spread-farmer | 5s | `spread_opportunity` | - | jupiter | Jupiter | あり |
| whale-tracker | 10s | `whale_move` | - | helius, coingecko | Helius + CoinGecko | なし |
