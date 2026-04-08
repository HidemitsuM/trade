# ---- Stage 1: builder ----
FROM node:22-slim AS builder

# python3, make, g++ are required for native addons (better-sqlite3)
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy root manifests
COPY package.json package-lock.json ./

# Copy all workspace package.json files for npm install resolution
COPY packages/core/package.json packages/core/
COPY packages/dashboard/package.json packages/dashboard/
COPY packages/orchestrator/package.json packages/orchestrator/
COPY packages/agents/arb-scanner/package.json packages/agents/arb-scanner/
COPY packages/agents/copy-trader/package.json packages/agents/copy-trader/
COPY packages/agents/liquidity-hunter/package.json packages/agents/liquidity-hunter/
COPY packages/agents/news-edge/package.json packages/agents/news-edge/
COPY packages/agents/portfolio-guard/package.json packages/agents/portfolio-guard/
COPY packages/agents/pump-sniper/package.json packages/agents/pump-sniper/
COPY packages/agents/spread-farmer/package.json packages/agents/spread-farmer/
COPY packages/agents/whale-tracker/package.json packages/agents/whale-tracker/

COPY packages/mcp-servers/1inch/package.json packages/mcp-servers/1inch/
COPY packages/mcp-servers/bnb-chain/package.json packages/mcp-servers/bnb-chain/
COPY packages/mcp-servers/browser/package.json packages/mcp-servers/browser/
COPY packages/mcp-servers/coingecko/package.json packages/mcp-servers/coingecko/
COPY packages/mcp-servers/coinmarketcap/package.json packages/mcp-servers/coinmarketcap/
COPY packages/mcp-servers/dune/package.json packages/mcp-servers/dune/
COPY packages/mcp-servers/git-mcp/package.json packages/mcp-servers/git-mcp/
COPY packages/mcp-servers/helius/package.json packages/mcp-servers/helius/
COPY packages/mcp-servers/jupiter/package.json packages/mcp-servers/jupiter/
COPY packages/mcp-servers/phantom/package.json packages/mcp-servers/phantom/
COPY packages/mcp-servers/polymarket/package.json packages/mcp-servers/polymarket/
COPY packages/mcp-servers/risk-manager/package.json packages/mcp-servers/risk-manager/

# Install all workspace dependencies
RUN npm install

# Copy only source and config (not __tests__ or dist)
COPY tsconfig.json ./
COPY config/ config/
COPY scripts/ scripts/

# Copy src and tsconfig for each package
COPY packages/core/src/ packages/core/src/
COPY packages/core/tsconfig.json packages/core/
COPY packages/dashboard/src/ packages/dashboard/src/
COPY packages/dashboard/tsconfig.json packages/dashboard/
COPY packages/orchestrator/src/ packages/orchestrator/src/
COPY packages/orchestrator/tsconfig.json packages/orchestrator/

COPY packages/agents/arb-scanner/src/ packages/agents/arb-scanner/src/
COPY packages/agents/arb-scanner/tsconfig.json packages/agents/arb-scanner/
COPY packages/agents/copy-trader/src/ packages/agents/copy-trader/src/
COPY packages/agents/copy-trader/tsconfig.json packages/agents/copy-trader/
COPY packages/agents/liquidity-hunter/src/ packages/agents/liquidity-hunter/src/
COPY packages/agents/liquidity-hunter/tsconfig.json packages/agents/liquidity-hunter/
COPY packages/agents/news-edge/src/ packages/agents/news-edge/src/
COPY packages/agents/news-edge/tsconfig.json packages/agents/news-edge/
COPY packages/agents/portfolio-guard/src/ packages/agents/portfolio-guard/src/
COPY packages/agents/portfolio-guard/tsconfig.json packages/agents/portfolio-guard/
COPY packages/agents/pump-sniper/src/ packages/agents/pump-sniper/src/
COPY packages/agents/pump-sniper/tsconfig.json packages/agents/pump-sniper/
COPY packages/agents/spread-farmer/src/ packages/agents/spread-farmer/src/
COPY packages/agents/spread-farmer/tsconfig.json packages/agents/spread-farmer/
COPY packages/agents/whale-tracker/src/ packages/agents/whale-tracker/src/
COPY packages/agents/whale-tracker/tsconfig.json packages/agents/whale-tracker/

COPY packages/mcp-servers/1inch/src/ packages/mcp-servers/1inch/src/
COPY packages/mcp-servers/1inch/tsconfig.json packages/mcp-servers/1inch/
COPY packages/mcp-servers/bnb-chain/src/ packages/mcp-servers/bnb-chain/src/
COPY packages/mcp-servers/bnb-chain/tsconfig.json packages/mcp-servers/bnb-chain/
COPY packages/mcp-servers/browser/src/ packages/mcp-servers/browser/src/
COPY packages/mcp-servers/browser/tsconfig.json packages/mcp-servers/browser/
COPY packages/mcp-servers/coingecko/src/ packages/mcp-servers/coingecko/src/
COPY packages/mcp-servers/coingecko/tsconfig.json packages/mcp-servers/coingecko/
COPY packages/mcp-servers/coinmarketcap/src/ packages/mcp-servers/coinmarketcap/src/
COPY packages/mcp-servers/coinmarketcap/tsconfig.json packages/mcp-servers/coinmarketcap/
COPY packages/mcp-servers/dune/src/ packages/mcp-servers/dune/src/
COPY packages/mcp-servers/dune/tsconfig.json packages/mcp-servers/dune/
COPY packages/mcp-servers/git-mcp/src/ packages/mcp-servers/git-mcp/src/
COPY packages/mcp-servers/git-mcp/tsconfig.json packages/mcp-servers/git-mcp/
COPY packages/mcp-servers/helius/src/ packages/mcp-servers/helius/src/
COPY packages/mcp-servers/helius/tsconfig.json packages/mcp-servers/helius/
COPY packages/mcp-servers/jupiter/src/ packages/mcp-servers/jupiter/src/
COPY packages/mcp-servers/jupiter/tsconfig.json packages/mcp-servers/jupiter/
COPY packages/mcp-servers/phantom/src/ packages/mcp-servers/phantom/src/
COPY packages/mcp-servers/phantom/tsconfig.json packages/mcp-servers/phantom/
COPY packages/mcp-servers/polymarket/src/ packages/mcp-servers/polymarket/src/
COPY packages/mcp-servers/polymarket/tsconfig.json packages/mcp-servers/polymarket/
COPY packages/mcp-servers/risk-manager/src/ packages/mcp-servers/risk-manager/src/
COPY packages/mcp-servers/risk-manager/tsconfig.json packages/mcp-servers/risk-manager/

RUN node scripts/build.mjs

# Prune devDependencies for the runner image
RUN npm prune --omit=dev

# ---- Stage 2: orchestrator ----
FROM node:22-slim AS orchestrator

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/config ./config
COPY --from=builder /app/package.json ./

EXPOSE 3000

CMD ["node", "packages/orchestrator/dist/index.js"]

# ---- Stage 2: dashboard ----
FROM node:22-slim AS dashboard

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/config ./config
COPY --from=builder /app/package.json ./

EXPOSE 3000

CMD ["node", "packages/dashboard/dist/index.js"]
