# API Key Setup Guide

This guide explains how to obtain and configure API keys for the Trade Orchestrator's MCP servers.

## Quick Start

1. Copy `.env.example` to `.env`
2. Fill in the API keys you need
3. Set `SIMULATION=false` to use real data

```bash
cp .env.example .env
# Edit .env with your API keys
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

1. https://bscscan.com/ にアクセス
2. アカウント作成 → API Key取得
3. または https://www.quicknode.com/ や https://www.alchemy.com/ で専用RPC
4. `.env` に設定:
   ```
   BSC_RPC_URL=https://bsc-dataseed.binance.org/
   ```

---

## Phantom ウォレット

**用途**: 実取引実行（秘密鍵）

> **警告**: 秘密鍵は絶対に公開リポジトリにコミットしないでください

1. Phantomウォレットから秘密鍵をエクスポート
2. `.env` に設定（環境変数のみ）:
   ```
   PHANTOM_PRIVATE_KEY=your_base58_encoded_private_key
   WALLET_ADDRESS=your_wallet_public_address
   ```

---

## GitHub Token（オプション）

**用途**: Git MCP サーバー用

1. https://github.com/settings/tokens にアクセス
2. 「Generate new token (classic)」→ `repo` スコープ
3. `.env` に設定:
   ```
   GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

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
