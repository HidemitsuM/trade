# Mainnet Readiness Fixes Design

**Date**: 2026-04-10
**Goal**: Fix all open issues (#32-#38) to make the trading system safe for $20 real-money operation on Solana mainnet.

## Overview

4-phase fix plan. Each phase is independently deployable.

## Phase 1: Configuration & Safety Guards (#32, #38)

### #32: Chain Configuration Unification

**Problem**: HELIUS_RPC_URL points to Solana devnet, BSC_RPC_URL points to BSC mainnet. ARB_CHAINS=solana,bsc causes meaningless cross-chain comparison.

**Fix**:
- Change `ARB_CHAINS=solana` (single chain)
- Comment out `BSC_RPC_URL` (future use)
- User must update `HELIUS_RPC_URL` to mainnet URL with valid API key
- `docker-compose.yml`: keep `SIMULATION=${SIMULATION:-true}` as safe default

**Files**: `.env`, `docker-compose.yml`

### #38: Zero Division Guard in portfolio-guard

**Problem**: `100 / portfolio.positions.length` → Infinity when positions is empty.

**Fix**: Early return with `{ actions: [] }` when `positions.length === 0`.

**Files**: `packages/agents/portfolio-guard/src/strategy.ts`

## Phase 2: Real Data Fixes (#34, #35, #37)

### #34: arb-scanner Random Spread Removal

**Problem**: After fetching CoinGecko price, uses `Math.random()` to generate spread instead of comparing real CEX vs DEX prices.

**Fix**:
1. Fetch CEX price from CoinGecko (`get_price`)
2. Fetch DEX price from Jupiter (`get_quote`)
3. Calculate real spread: `dex_price - cex_price`
4. Only signal when `spread > ARB_MIN_PROFIT_USD`
5. Remove all `Math.random()` calls from `fetchRealPrices()`

**Token mapping**: SOL/USDT using CoinGecko coin_id `solana` and Jupiter mint addresses.

**Files**: `packages/agents/arb-scanner/src/agent.ts`

### #35: Hardcoded Price Removal

**Problem**: copy-trader uses `BTC=50000, ETH=3000, SOL=150`. news-edge uses same pattern.

**Fix**: Add `getTokenPrice(token: string): Promise<number>` helper to each agent. Fetches real price from CoinGecko MCP. On failure, throw error (triggers simulation fallback, skip trade).

**Token mapping**: SOL→`solana`, BTC→`bitcoin`, ETH→`ethereum`, default→lowercase token name.

**Files**:
- `packages/agents/copy-trader/src/agent.ts`
- `packages/agents/news-edge/src/agent.ts`

### #37: MCP Response Validation

**Problem**: All agents use `as` type assertion without validating MCP response structure.

**Fix**: Add explicit null/type checks after each `mcpPool.callTool()` call. Throw descriptive error on invalid response. Existing try/catch in tick() handles fallback.

**Validation pattern**:
```typescript
const res = await this.mcpPool!.callTool(server, tool, args);
if (!res || typeof (res as any).expectedField !== 'number' || (res as any).expectedField <= 0) {
  throw new Error(`Invalid ${server}.${tool} response: ${JSON.stringify(res)}`);
}
```

**Affected agents**: arb-scanner, pump-sniper, spread-farmer, news-edge, liquidity-hunter, portfolio-guard

**Files**: All `packages/agents/*/src/agent.ts`

## Phase 3: Polling Implementation (#33)

### whale-tracker: Polling-Based Whale Monitoring

**Problem**: Always uses simulation because WebSocket/subscription MCP tools don't exist.

**Fix**: Use Helius MCP `get_signatures_for_address` to poll recent transactions for known whale wallets. Filter transactions exceeding `WHALE_MIN_USD` threshold.

**Design**:
- `tick()`: Poll monitored wallet addresses for recent transactions
- Parse transaction amounts using Helius `get_transaction_details` or similar
- Emit `whale_move` signals for transactions > WHALE_MIN_USD
- Monitored wallets: configurable via env var `WHALE_WATCH_ADDRESSES` (comma-separated)

**New env vars**:
- `WHALE_WATCH_ADDRESSES`: comma-separated list of wallet addresses to monitor (optional, defaults to empty = simulation fallback)

**Files**: `packages/agents/whale-tracker/src/agent.ts`

### copy-trader: Signal-Driven Trading

**Problem**: Always uses simulation, generates its own copy signals.

**Fix**: Refactor to be primarily signal-driven:
- `getSubscribedSignalTypes()` returns `['whale_move']`
- `onSignal(signal)`: When whale_move received, fetch token price from CoinGecko, validate against COPY_MAX_USD, execute copy trade
- `tick()`: No-op or lightweight status check (remove simulation signal generation)

**Files**: `packages/agents/copy-trader/src/agent.ts`

## Phase 4: Dashboard Security (#36)

### XSS Fix

**Problem**: `tbody.innerHTML = data.trades.map(...)` allows XSS if agent names contain HTML.

**Fix**: Replace innerHTML with DOM API:
```javascript
tbody.innerHTML = '';
for (const t of data.trades) {
  const tr = document.createElement('tr');
  // Use textContent for all cell values
  tr.append(td(t.timestamp), td(t.agent), td(t.pair), ...);
  tbody.appendChild(tr);
}
```

### Security Headers

Add to all HTTP responses:
- `Content-Security-Policy: default-src 'self'; style-src 'unsafe-inline'`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`

### Dynamic Agent Count

Replace hardcoded `active_agents: 8` with:
- Query `agent_state` table from DB for actual agent statuses
- Fallback to known agents list if DB query fails

**Files**: `packages/dashboard/src/server.ts`

## Risk Parameters for $20 Seed

After all fixes, update `.env` risk parameters:

| Parameter | Current | New | Reason |
|-----------|---------|-----|--------|
| MAX_TOTAL_EXPOSURE_USD | 5000 | 15 | 75% of capital |
| MAX_SINGLE_TRADE_USD | 500 | 2 | Conservative per-trade |
| CIRCUIT_BREAKER_LOSS_USD | 200 | 5 | Stop at $5 loss |
| PUMP_MAX_POSITION_USD | 200 | 3 | Tiny positions |
| COPY_MAX_USD | 300 | 2 | Copy trade limit |
| ARB_MIN_PROFIT_USD | 5 | 0.5 | Meaningful at $2 trades |
| GUARD_STOP_LOSS_PCT | 8 | 5 | Earlier stop loss |
| WHALE_MIN_USD | 10000 | 1000 | Lower threshold for $20 scale |

## Implementation Order

1. Phase 1 → test → verify devnet works
2. Phase 2 → test → verify real data flows
3. Phase 3 → test → verify whale/copy functionality
4. Phase 4 → test → verify dashboard security
5. Update risk parameters
6. Switch to mainnet RPC URL
7. Start with $20

## Testing Strategy

- Each phase: run `npm test` to verify no regressions
- Phase 2: Add unit tests for `getTokenPrice()` and validation logic
- Phase 3: Test whale-tracker with mock Helius responses
- Phase 4: Test XSS protection with HTML in agent names
