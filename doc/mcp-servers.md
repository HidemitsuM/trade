# MCPサーバー詳細

MCP (Model Context Protocol) サーバーは、エージェントが外部APIにアクセスするためのstdoベースのプロセス。各サーバーは`@modelcontextprotocol/sdk`で実装され、zodで入力バリデーションを行う。

## 共通パターン

```
tools.ts (業務ロジッククラス)
  ↕ HTTP
外部API

index.ts (MCPサーバー)
  ↕ stdio
Agent (MCPConnectionPool経由)
```

---

## 1. coingecko - CoinGecko 価格データ

**パッケージ**: `@trade/mcp-coingecko` | **認証**: API Key任意

### ツール

| ツール名 | 入力 | 出力 | 説明 |
|---------|------|------|------|
| `get_price` | `coin_id`, `vs_currency?` (default: usd) | `number` | 現在価格 |
| `get_trending` | なし | `TrendingCoin[]` | トレンドコイン一覧 |
| `get_token_info` | `coin_id` | `TokenDetail` | 詳細: 価格・24hボリューム・価格変化率・market_cap_rank |

### 外部API
- `GET https://api.coingecko.com/api/v3/simple/price`
- `GET https://api.coingecko.com/api/v3/search/trending`
- `GET https://api.coingecko.com/api/v3/coins/{id}`

### 利用エージェント
arb-scanner, copy-trader, liquidity-hunter, news-edge, portfolio-guard, pump-sniper, whale-tracker (7エージェント)

---

## 2. coinmarketcap - CoinMarketCap データ

**パッケージ**: `@trade/mcp-coinmarketcap` | **認証**: API Key必須

### ツール

| ツール名 | 入力 | 出力 | 説明 |
|---------|------|------|------|
| `get_price` | `symbols[]` (例: ["SOL","ETH"]) | `Record<string, Quote>` | 複数シンボルの価格・MarketCap・ボリューム |
| `get_fear_greed` | なし | `{ value, classification }` | Fear & Greed指数 |

### 外部API
- `GET https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest`
- `GET https://pro-api.coinmarketcap.com/v3/fear-and-greed`

### 利用エージェント
news-edge

---

## 3. helius - Helius Solana RPC

**パッケージ**: `@trade/mcp-helius` | **認証**: URL内API Key

### ツール

| ツール名 | 入力 | 出力 | 説明 |
|---------|------|------|------|
| `get_transaction` | `signature` | `TransactionInfo` | トランザクション詳細 |
| `get_token_info` | `mint` | `TokenInfo` | トークンメタデータ (DAS API) |
| `get_account_balance` | `address` | `BalanceInfo` | SOL残高 (lamports + SOL) |
| `get_signatures_for_address` | `address`, `limit?` | `SignatureInfo[]` | 直近トランザクション署名一覧 |

### 外部API
- Helius RPC JSON-RPC: `getTransaction`, `getAsset`, `getBalance`, `getSignaturesForAddress`

### 利用エージェント
whale-tracker, portfolio-guard

---

## 4. jupiter - Jupiter DEX アグリゲーター

**パッケージ**: `@trade/mcp-jupiter` | **認証**: 不要

### ツール

| ツール名 | 入力 | 出力 | 説明 |
|---------|------|------|------|
| `get_quote` | `input_mint`, `output_mint`, `amount` | `Quote` | スワップクォート (価格インパクト付き) |
| `get_routes` | `input_mint`, `output_mint`, `amount` | `RoutesResult` | 利用可能ルート一覧 |

### 外部API
- `GET https://quote-api.jup.ag/v6/quote`
- `GET https://quote-api.jup.ag/v6/routes`

### 利用エージェント
arb-scanner, spread-farmer

---

## 5. 1inch - 1inch DEX アグリゲーター (BSC)

**パッケージ**: `@trade/mcp-1inch` | **認証**: Bearer Token必須

### ツール

| ツール名 | 入力 | 出力 | 説明 |
|---------|------|------|------|
| `get_quote` | `from_token`, `to_token`, `amount` | `SwapQuote` | BSCスワップクォート |
| `get_spender` | なし | `string` (アドレス) | トークン承認用spenderアドレス |

### 外部API
- `GET https://api.1inch.dev/swap/v6.0/{chainId}/quote`
- `GET https://api.1inch.dev/swap/v6.0/{chainId}/approve/spender`

### 利用エージェント
(現在オーケストレータに登録済みだが直接使用するエージェントなし)

---

## 6. phantom - Phantom Wallet / Solana

**パッケージ**: `@trade/mcp-phantom` | **認証**: URL内API Key + Private Key

### ツール

| ツール名 | 入力 | 出力 | 説明 |
|---------|------|------|------|
| `get_balance` | `address` | `{ lamports, sol }` | SOL残高 |
| `send_transaction` | `serialized_tx` | `signature` | 署名済みトランザクション送信 |
| `get_token_accounts` | `address` | `TokenAccount[]` | SPLトークンアカウント一覧 |

### 外部API
- Solana RPC: `getBalance`, `sendTransaction`, `getTokenAccountsByOwner`

### 特記事項
- `PHANTOM_PRIVATE_KEY` は受理するが現在使用しない（署名は外部で行う想定）

---

## 7. bnb-chain - BSC RPC

**パッケージ**: `@trade/mcp-bnb-chain` | **認証**: 不要

### ツール

| ツール名 | 入力 | 出力 | 説明 |
|---------|------|------|------|
| `get_balance` | `address` | `{ wei, bnb }` | BNB残高 |
| `call_contract` | `contract_address`, `data` | `hex` | コントラクト読み取り |
| `get_transaction_count` | `address` | `hex` | ノンス取得 |

### 外部API
- BSC RPC JSON-RPC: `eth_getBalance`, `eth_call`, `eth_getTransactionCount`

---

## 8. dune - Dune Analytics

**パッケージ**: `@trade/mcp-dune` | **認証**: API Key必須

### ツール

| ツール名 | 入力 | 出力 | 説明 |
|---------|------|------|------|
| `execute_query` | `query_id` | `DuneResult` | クエリ実行をトリガー |
| `get_query_results` | `query_id` | `DuneResult` | キャッシュされた結果を取得 |

### 外部API
- `POST https://api.dune.com/api/v1/query/{id}/execute`
- `GET https://api.dune.com/api/v1/query/{id}/results`

### 特記事項
- `execute_query` は即時リターン（完了待機なし）。結果は `get_query_results` で別途取得。

---

## 9. browser - Webブラウザ / スクレイパー

**パッケージ**: `@trade/mcp-browser` | **認証**: 不要

### ツール

| ツール名 | 入力 | 出力 | 説明 |
|---------|------|------|------|
| `scrape_page` | `url`, `timeout_ms?` | `{ title, content }` | ページスクレイピング |
| `check_social` | `url`, `timeout_ms?` | `{ title, content }` | ソーシャルメディアチェック |

### 実装
- Playwright (Chromium) でヘッドレスブラウザ起動
- `check_social` は実質的に `scrape_page` と同一（センチメント分析は未実装）

---

## 10. git-mcp - GitHub リポジトリアクセス

**パッケージ**: `@trade/mcp-git` | **認証**: Token任意

### ツール

| ツール名 | 入力 | 出力 | 説明 |
|---------|------|------|------|
| `search_repos` | `query` | `RepoInfo[]` | リポジトリ検索 |
| `get_file_content` | `repo`, `path` | `string` | ファイル内容取得 (base64デコード) |
| `get_repo_info` | `repo` | `RepoInfo` | リポジトリメタデータ |

### 外部API
- GitHub REST API v3: `search/repositories`, `repos/{owner}/{repo}/contents/{path}`, `repos/{owner}/{repo}`

---

## 11. polymarket - Polymarket 予測市場

**パッケージ**: `@trade/mcp-polymarket` | **認証**: API Key + Private Key

### ツール

| ツール名 | 入力 | 出力 | 説明 |
|---------|------|------|------|
| `get_markets` | なし | `Market[]` | アクティブ市場一覧 |
| `get_orderbook` | `token_id` | `Orderbook` | オーダーブック (bids/asks) |

### 外部API
- `GET https://clob.polymarket.com/markets`
- `GET https://clob.polymarket.com/book`

### 特記事項
- 読み取り専用（注文機能なし）
- `get_orderbook` は認証ヘッダーを送信しない

---

## 12. risk-manager - リスク管理 (内部ロジック)

**パッケージ**: `@trade/mcp-risk-manager` | **認証**: 不要 | **外部API**: なし

### ツール

| ツール名 | 入力 | 出力 | 説明 |
|---------|------|------|------|
| `check_trade` | `agent`, `amount_usd`, `current_exposure` | `TradeCheckResult` | 取引承認チェック |
| `circuit_breaker_status` | なし | `{ active, daily_pnl, drawdown_pct, drawdown_breached }` | サーキットブレーカー状態 |
| `record_trade_result` | `pnl` | `{ daily_pnl, circuit_breaker }` | 取引結果記録 |

### 承認ロジック (順序)
1. サーキットブレーカー発動中 → 拒否
2. `amount > max_single_trade_usd` → 拒否
3. `current_exposure + amount > max_total_exposure_usd` → 拒否
4. 上記以外 → 承認

### サーキットブレーカー発動条件
- 日次PnL累積が `-circuit_breaker_loss_usd` 以下
- または日次PnLが `-daily_loss_limit_usd` 以下

### 特記事項
- 全状態がインメモリ（プロセス再起動でリセット）
- ドローダウン追跡メソッドは存在するがMCPツールとして公開されていない

---

## オーケストレータ登録状況

オーケストレータは6つのMCPサーバーを子プロセスで起動:

| 登録名 | パッケージ | 用途 |
|-------|----------|------|
| `coingecko` | @trade/mcp-coingecko | 価格データ |
| `coinmarketcap` | @trade/mcp-coinmarketcap | 市場データ・センチメント |
| `helius` | @trade/mcp-helius | Solana RPC |
| `jupiter` | @trade/mcp-jupiter | DEXクォート |
| `1inch` | @trade/mcp-1inch | BSC DEXクォート |
| `phantom` | @trade/mcp-phantom | ウォレット操作 |

未登録（スタンドアローン利用のみ）: bnb-chain, browser, dune, git-mcp, polymarket, risk-manager
