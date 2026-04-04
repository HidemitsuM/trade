# API Keys Guide

This guide describes how to obtain each API key required by the MCP servers in this project.

---

## Helius

- **MCP Server**: `helius`
- **Environment Variable**: `HELIUS_RPC_URL`
- **Purpose**: Solana RPC endpoint for on-chain data queries and transaction monitoring.
- **How to obtain**:
  1. Go to [https://dev.helius.xyz](https://dev.helius.xyz)
  2. Create an account or sign in.
  3. Create a new project and copy the RPC URL (mainnet or devnet).
- **Required**: Yes (for Solana-related agents)

---

## Dune

- **MCP Server**: `dune`
- **Environment Variable**: `DUNE_API_KEY`
- **Purpose**: Query on-chain analytics and custom SQL dashboards via the Dune API.
- **How to obtain**:
  1. Go to [https://dune.com](https://dune.com)
  2. Create an account.
  3. Navigate to Settings > API Key and generate a new key.
- **Required**: No (optional analytics)

---

## CoinMarketCap

- **MCP Server**: `coinmarketcap`
- **Environment Variable**: `CMC_API_KEY`
- **Purpose**: Fetch cryptocurrency market data (prices, market cap, volume).
- **How to obtain**:
  1. Go to [https://pro.coinmarketcap.com](https://pro.coinmarketcap.com)
  2. Create a free account.
  3. Navigate to the Dashboard and copy your API Key.
- **Required**: No (optional price data; CoinGecko can substitute)

---

## CoinGecko

- **MCP Server**: `coingecko`
- **Environment Variable**: `COINGECKO_API_KEY`
- **Purpose**: Fetch cryptocurrency price data, market charts, and token information.
- **How to obtain**:
  1. Go to [https://www.coingecko.com/en/api](https://www.coingecko.com/en/api)
  2. Create an account.
  3. Subscribe to a plan (Free tier available) and copy your API key.
- **Required**: No (optional price data; CoinMarketCap can substitute)

---

## GitHub

- **MCP Server**: `git-mcp`
- **Environment Variable**: `GITHUB_TOKEN`
- **Purpose**: Access repository data, issues, and pull requests for project management.
- **How to obtain**:
  1. Go to [https://github.com/settings/tokens](https://github.com/settings/tokens)
  2. Click "Generate new token (classic)" or use fine-grained tokens.
  3. Select the `repo` scope and generate.
- **Required**: No (optional development tooling)

---

## BSC RPC

- **MCP Server**: `bnb-chain`
- **Environment Variable**: `BSC_RPC_URL`
- **Purpose**: BNB Smart Chain RPC endpoint for on-chain data and transactions.
- **How to obtain**:
  1. Use a public RPC (e.g., `https://bsc-dataseed.binance.org`) or sign up at a provider like [https://www.quicknode.com](https://www.quicknode.com), [https://infura.io](https://infura.io), or [https://chainstack.com](https://chainstack.com).
  2. Create a project and copy the BSC mainnet endpoint URL.
- **Required**: Yes (for BSC-related agents)

---

## 1inch

- **MCP Server**: `1inch`
- **Environment Variable**: `ONEINCH_API_KEY`
- **Purpose**: Token swap aggregation and DEX liquidity data across multiple chains.
- **How to obtain**:
  1. Go to [https://portal.1inch.dev](https://portal.1inch.dev)
  2. Create an account.
  3. Create a new project and copy the API key.
- **Required**: No (optional swap execution)

---

## Polymarket

- **MCP Server**: `polymarket`
- **Environment Variable**: `POLYMARKET_API_KEY`
- **Purpose**: Access prediction market data and execute trades on Polymarket.
- **How to obtain**:
  1. Go to [https://polymarket.com](https://polymarket.com)
  2. Create an account.
  3. Generate an API key from your account settings.
- **Required**: No (optional prediction market data)

---

## Phantom

- **MCP Server**: `phantom`
- **Environment Variable**: `PHANTOM_PRIVATE_KEY`
- **Purpose**: Sign and submit Solana transactions via the Phantom wallet integration.
- **How to obtain**:
  1. Export the private key from your Phantom wallet extension.
  2. In Phantom, go to Settings > Security > Export Private Key.
  3. **Warning**: Never share or commit this key. Store it securely.
- **Required**: Yes (for on-chain transaction execution)
- **Security**: This is a private key. Treat it as a secret. Never commit it to version control.

---

## Summary

| Variable | MCP Server | Required |
|---|---|---|
| `HELIUS_RPC_URL` | helius | Yes |
| `DUNE_API_KEY` | dune | No |
| `CMC_API_KEY` | coinmarketcap | No |
| `COINGECKO_API_KEY` | coingecko | No |
| `GITHUB_TOKEN` | git-mcp | No |
| `BSC_RPC_URL` | bnb-chain | Yes |
| `ONEINCH_API_KEY` | 1inch | No |
| `POLYMARKET_API_KEY` | polymarket | No |
| `PHANTOM_PRIVATE_KEY` | phantom | Yes |
