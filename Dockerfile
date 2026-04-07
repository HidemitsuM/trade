# ---- Stage 1: builder ----
FROM node:22-slim AS builder

# python3, make, g++ are required for native addons (better-sqlite3)
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy root manifests
COPY package.json package-lock.json ./

# Copy all workspace package.json files for npm ci resolution
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

# Copy source code and build
COPY tsconfig.json vitest.config.ts ./
COPY config/ config/
COPY packages/ packages/
COPY scripts/ scripts/
RUN node scripts/build.mjs

# Prune devDependencies for the runner image
RUN npm prune --omit=dev

# ---- Stage 2: runner ----
FROM node:22-slim

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/config ./config
COPY --from=builder /app/package.json ./

EXPOSE 3000

CMD ["node", "packages/orchestrator/dist/index.js"]
