# API Key Setup Guide

Trade OrchestratorのMCPサーバーで使用するAPIキーの取得・設定方法を説明します。

## Quick Start

1. `.env.example` を `.env` にコピー
2. 必要なAPIキーを記入
3. `SIMULATION=false` でリアルデータモードに切替

```bash
cp .env.example .env
# .envにAPIキーを記入
```

---

## CoinGecko

**用途**: 価格データ、トレンド情報、トークン詳細

1. https://www.coingecko.com/en/api にアクセス
2. 「Get Your Free API Key」をクリック
3. アカウント作成後、ダッシュボードからAPI Keyを取得
4. `.env` に設定:
   ```
   COINGECKO_API_KEY=CG-xxxxxxxxxxxxxxxxxxxx
   ```
- 無料プラン: 30 calls/min

---

## CoinMarketCap

**用途**: Fear & Greed指数、市場データ

1. https://pro.coinmarketcap.com/signup にアクセス
2. 無料Basicプランで登録
3. ダッシュボードの「API Keys」からキーを取得
4. `.env` に設定:
   ```
   CMC_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   ```
- 無料プラン: 10,000 calls/month, 30 calls/min

---

## Helius (Solana RPC)

**用途**: Solanaブロックチェーンデータ、トランザクション、ウォレット残高

1. https://dev.helius.xyz/ にアクセス
2. 「Start Building for Free」→ サインイン
3. 新しいAPI Keyを作成
4. RPC URL（`https://mainnet.helius-rpc.com/?api-key=YOUR_KEY`）を取得
5. `.env` に設定:
   ```
   HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   ```
- 無料プラン: 50,000 credits/day

---

## 1inch

**用途**: DEXアグリゲーション、クロスチェーンスワップ

1. https://portal.1inch.dev/ にアクセス
2. 「Get API Key」→ アカウント作成
3. プロジェクトを作成してAPI Keyを取得
4. `.env` に設定:
   ```
   ONEINCH_API_KEY=xxxxxxxx
   ```
- チェーンID設定（デフォルト: 56 = BSC）:
   ```
   CHAIN_ID=56
   ```
- 無料プラン: 利用可能（レート制限あり）

---

## Dune Analytics

**用途**: オンチェーン分析クエリ

1. https://dune.com/ にアクセス
2. アカウント作成
3. https://dune.com/settings/api-keys からAPI Keyを取得
4. `.env` に設定:
   ```
   DUNE_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
- 無料プラン: クエリ実行制限あり

---

## BSC RPC

**用途**: BNB Chain ブロックチェーンデータ

パブリックRPCを使用するか、専用RPCを取得:

1. https://bscscan.com/ にアクセス → アカウント作成 → API Key取得
2. または https://www.quicknode.com/ や https://www.alchemy.com/ で専用RPC
3. `.env` に設定:
   ```
   # パブリックRPC（APIキー不要、レート制限あり）
   BSC_RPC_URL=https://bsc-dataseed.binance.org/
   
   # または BscScan API Key付きRPC
   BSC_RPC_URL=https://bsc-dataseed1.ninicoin.io/
   ```

---

## Polymarket

**用途**: 予測市場データ、取引実行

> **警告**: `POLYMARKET_PRIVATE_KEY` は資金に直接アクセスできる秘密鍵です。絶対に公開リポジトリにコミットしないでください

1. https://polymarket.com/ にアクセス
2. ウォレット接続後、API Keyを取得
3. 秘密鍵はウォレットの設定からエクスポート
4. `.env` に設定:
   ```
   POLYMARKET_API_KEY=xxxxxxxx
   POLYMARKET_PRIVATE_KEY=your_private_key
   ```

---

## Phantom ウォレット

**用途**: 実取引実行（Solana秘密鍵）

> **警告**: 秘密鍵は絶対に公開リポジトリにコミットしないでください。`.env`が`.gitignore`に含まれていることを確認してください

1. Phantomウォレットアプリ → 設定 → Security → Export Private Key
2. または `solana-keygen` CLIでキーペアから秘密鍵を導出
3. `.env` に設定（環境変数のみ）:
   ```
   PHANTOM_PRIVATE_KEY=your_base58_encoded_private_key
   WALLET_ADDRESS=your_wallet_public_address
   ```

---

## GitHub Token（オプション）

**用途**: Git MCP サーバー用

1. https://github.com/settings/tokens にアクセス
2. 「Generate new token (classic)」→ 必要最小限のスコープ（読み取り専用なら `public_repo`）
3. `.env` に設定:
   ```
   GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

---

## APIキー不要のMCPサーバー

以下のサーバーはAPIキー不要で動作します:

| サーバー | 説明 |
|---------|------|
| **Jupiter** | Solana DEXパブリックAPI（スワップクォート） |
| **Browser** | Webスクレイピング（fetch使用） |
| **Risk Manager** | リスク計算（外部API不使用） |

---

## セキュリティベストプラクティス

- `.env` をGitにコミットしない（`.gitignore`に含まれていることを確認）
- 本番用ウォレットとは別に、テスト/開発専用のウォレットを使用
- 実際の秘密鍵を使用する前に、`SIMULATION=true`で動作確認
- 秘密鍵の漏洩は資金の全損失につながる可能性があります

---

## 最小構成で始める場合

シミュレーションモード（デフォルト）ではAPIキー不要です:

```
SIMULATION=true
```

リアルデータを使いたい場合の最小構成:
```
SIMULATION=false
COINGECKO_API_KEY=your_key
HELIUS_RPC_URL=your_url
```
