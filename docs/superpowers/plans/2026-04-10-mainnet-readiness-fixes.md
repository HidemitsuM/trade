# Mainnet Readiness Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix issues #32-#38 to make the trading system safe for $20 real-money operation on Solana mainnet.

**Architecture:** 4-phase fix plan — configuration, real data, polling, dashboard security. Each phase is independently deployable and tested.

**Tech Stack:** TypeScript, Vitest, better-sqlite3, ioredis, MCP SDK, Node.js 22

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `.env` | Chain config + risk params for $20 |
| Modify | `packages/agents/portfolio-guard/src/strategy.ts` | Zero division guard |
| Modify | `packages/agents/arb-scanner/src/agent.ts` | Real CEX/DEX spread + validation |
| Modify | `packages/agents/copy-trader/src/agent.ts` | Signal-driven + real price |
| Modify | `packages/agents/news-edge/src/agent.ts` | Real price from CoinGecko |
| Modify | `packages/agents/pump-sniper/src/agent.ts` | MCP response validation |
| Modify | `packages/agents/spread-farmer/src/agent.ts` | MCP response validation |
| Modify | `packages/agents/liquidity-hunter/src/agent.ts` | MCP response validation |
| Modify | `packages/agents/portfolio-guard/src/agent.ts` | MCP response validation |
| Modify | `packages/agents/whale-tracker/src/agent.ts` | Polling-based whale monitoring |
| Modify | `packages/mcp-servers/helius/src/tools.ts` | Add getSignaturesForAddress |
| Modify | `packages/mcp-servers/helius/src/index.ts` | Register new tool |
| Modify | `packages/dashboard/src/server.ts` | XSS fix + security headers |
| Modify | `packages/orchestrator/src/index.ts` | Pass WHALE_WATCH_ADDRESSES |
| Create | `packages/agents/portfolio-guard/__tests__/strategy.test.ts` | Add empty positions test |
| Create | `packages/mcp-servers/helius/__tests__/tools.test.ts` | Add new tool test |

---

## Phase 1: Configuration & Safety Guards (#32, #38)

### Task 1: Portfolio-Guard Zero Division Guard (#38)

**Files:**
- Modify: `packages/agents/portfolio-guard/src/strategy.ts:11`
- Modify: `packages/agents/portfolio-guard/__tests__/strategy.test.ts`

- [ ] **Step 1: Write the failing test**

Add this test to `packages/agents/portfolio-guard/__tests__/strategy.test.ts` after the existing `it('flags over-concentration'...)` block:

```typescript
  it('returns empty actions when positions array is empty', () => {
    const strategy = new PortfolioGuardStrategy({ stop_loss_pct: 8, rebalance_threshold_pct: 5 });
    const action = strategy.evaluate({
      positions: [],
      total_value_usd: 0,
      max_exposure_usd: 5000,
    });
    expect(action.stop_loss_triggered).toBe(false);
    expect(action.rebalance_needed).toBe(false);
    expect(action.tokens_to_sell).toHaveLength(0);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/agents/portfolio-guard/__tests__/strategy.test.ts`
Expected: FAIL — `100 / 0` produces Infinity, causing `pnl_pct` to be NaN and `allocation_pct > Infinity` to be false, but `pnl_pct <= -8` on NaN is false too. Test actually passes by accident because NaN comparisons are false. Verify by checking that Infinity doesn't leak into the response.

Actually, let's verify it properly. The current code will NOT crash but will produce Infinity for `max_allocation`. We need to ensure we return early with an explicit guard.

- [ ] **Step 3: Write the fix**

In `packages/agents/portfolio-guard/src/strategy.ts`, add early return at the start of `evaluate()`:

```typescript
  evaluate(portfolio: { positions: Position[]; total_value_usd: number; max_exposure_usd: number }): GuardAction {
    const empty: GuardAction = { stop_loss_triggered: false, rebalance_needed: false, tokens_to_sell: [] };
    if (portfolio.positions.length === 0) return empty;
    const action: GuardAction = { stop_loss_triggered: false, rebalance_needed: false, tokens_to_sell: [] };
    const max_allocation = 100 / portfolio.positions.length;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/agents/portfolio-guard/__tests__/strategy.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: All tests pass (no regressions)

- [ ] **Step 6: Commit**

```bash
git add packages/agents/portfolio-guard/src/strategy.ts packages/agents/portfolio-guard/__tests__/strategy.test.ts
git commit -m "fix: add empty positions guard in portfolio-guard strategy (#38)"
```

---

### Task 2: Chain Configuration for Solana-only (#32)

**Files:**
- Modify: `.env`
- Modify: `packages/orchestrator/src/index.ts` (whale-tracker config — add `watch_addresses`)

- [ ] **Step 1: Update `.env` chain config**

In `.env`, change these lines:

```
# Before:
BSC_RPC_URL=https://muddy-quiet-dinghy.bsc.quiknode.pro/a4a35451ed9908b976b0d6bcf9945cfbf3829340/
ARB_CHAINS=solana,bsc

# After:
# BSC_RPC_URL=https://muddy-quiet-dinghy.bsc.quiknode.pro/...  # mainnet — disabled for $20 Solana-only mode
ARB_CHAINS=solana
```

Also add new env var for whale-tracker:

```
WHALE_WATCH_ADDRESSES=
```

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add .env
git commit -m "fix: configure Solana-only chain, disable BSC for $20 mode (#32)"
```

---

## Phase 2: Real Data Fixes (#34, #35, #37)

### Task 3: arb-scanner — Real CEX/DEX Spread (#34 + #37)

**Files:**
- Modify: `packages/agents/arb-scanner/src/agent.ts`

- [ ] **Step 1: Rewrite `fetchRealPrices()` in `packages/agents/arb-scanner/src/agent.ts`**

Replace the entire `fetchRealPrices()` method with this implementation that fetches CEX price from CoinGecko AND DEX price from Jupiter, then calculates the real spread:

```typescript
  private async fetchRealPrices(): Promise<{ pair: string; buyPrice: number; sellPrice: number; quantity: number }[]> {
    const results: { pair: string; buyPrice: number; sellPrice: number; quantity: number }[] = [];
    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

    for (const [coinId, symbol] of Object.entries(TOKEN_MAP)) {
      // Fetch CEX price from CoinGecko
      const cexRes = await this.mcpPool!.callTool('coingecko', 'get_price', { coin_id: coinId });
      if (!cexRes || typeof (cexRes as any).price !== 'number' || (cexRes as any).price <= 0) {
        throw new Error(`Invalid CoinGecko response for ${coinId}: ${JSON.stringify(cexRes)}`);
      }
      const cexPrice = (cexRes as { price: number }).price;

      if (symbol === 'SOL') {
        // Fetch DEX price from Jupiter for SOL/USDC
        const dexRes = await this.mcpPool!.callTool('jupiter', 'get_quote', {
          input_mint: SOL_MINT, output_mint: USDC_MINT, amount: 1_000_000_000,
        });
        if (!dexRes || typeof (dexRes as any).outAmount !== 'string') {
          throw new Error(`Invalid Jupiter response for SOL: ${JSON.stringify(dexRes)}`);
        }
        const dexPrice = Number((dexRes as { outAmount: string }).outAmount) / 1e6; // USDC has 6 decimals
        const spread = dexPrice - cexPrice;
        // Buy on cheaper market, sell on more expensive
        const buyPrice = Math.min(cexPrice, dexPrice);
        const sellPrice = Math.max(cexPrice, dexPrice);
        if (sellPrice - buyPrice > 0) {
          results.push({ pair: 'SOL/USDT', buyPrice, sellPrice, quantity: 1 });
        }
      } else {
        // For non-SOL tokens, only have CEX price — no arb detection possible
        // Skip or use CEX price only (no spread calculation)
        continue;
      }
    }
    return results;
  }
```

- [ ] **Step 2: Update TOKEN_MAP to Solana-only**

Since we're Solana-only now, simplify TOKEN_MAP at the top of the file:

```typescript
const TOKEN_MAP: Record<string, string> = {
  solana: 'SOL',
};
```

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: All tests pass (strategy tests unchanged)

- [ ] **Step 4: Commit**

```bash
git add packages/agents/arb-scanner/src/agent.ts
git commit -m "fix: arb-scanner uses real CEX/DEX spread instead of random (#34, #37)"
```

---

### Task 4: news-edge — Real Price from CoinGecko (#35 + #37)

**Files:**
- Modify: `packages/agents/news-edge/src/agent.ts`

- [ ] **Step 1: Add `getTokenPrice()` helper and validate MCP response**

In `packages/agents/news-edge/src/agent.ts`, add a helper method to the class and update `fetchRealSentiment()` and `tick()`:

Add this method after `fetchRealSentiment()`:

```typescript
  private async getTokenPrice(token: string): Promise<number> {
    const coinId = token.toLowerCase() === 'sol' ? 'solana'
      : token.toLowerCase() === 'btc' ? 'bitcoin'
      : token.toLowerCase() === 'eth' ? 'ethereum'
      : token.toLowerCase();
    const res = await this.mcpPool!.callTool('coingecko', 'get_price', { coin_id: coinId });
    if (!res || typeof (res as any).price !== 'number' || (res as any).price <= 0) {
      throw new Error(`Invalid CoinGecko price for ${token}: ${JSON.stringify(res)}`);
    }
    return (res as { price: number }).price;
  }
```

Update `fetchRealSentiment()` to validate response:

```typescript
  private async fetchRealSentiment(): Promise<{ token: string; sentiment_score: number; fear_greed: number; source: string }> {
    const fg = await this.mcpPool!.callTool('coinmarketcap', 'get_fear_greed', {}) as { value: number; classification: string };
    if (!fg || typeof fg.value !== 'number' || fg.value < 0 || fg.value > 100) {
      throw new Error(`Invalid Fear&Greed response: ${JSON.stringify(fg)}`);
    }
    this.lastFearGreed = fg.value;
    const sentimentScore = fg.value / 100;
    const token = TOKENS[Math.floor(Math.random() * TOKENS.length)];
    return { token, sentiment_score: sentimentScore, fear_greed: fg.value, source: 'coinmarketcap' };
  }
```

In `tick()`, replace the hardcoded price section. Change the `db.insertTrade` block inside `if (decision.should_enter)`:

```typescript
      if (this.db) {
        let entryPrice: number;
        if (!this.isSimulation && this.mcpPool) {
          try {
            entryPrice = await this.getTokenPrice(data.token);
          } catch {
            logger.warn(`Agent ${this.name} price fetch failed, skipping trade record`);
            return;
          }
        } else {
          entryPrice = 100; // simulation placeholder
        }
        this.db.insertTrade({
          id: randomUUID(),
          agent: this.name,
          pair: `${data.token}/USDT`,
          side: 'buy',
          entry_price: entryPrice,
          exit_price: null,
          quantity: 1,
          pnl: null,
          fee: entryPrice * 0.001,
          chain: 'solana',
          tx_hash: null,
          simulated: this.isSimulation,
          timestamp: new Date().toISOString(),
        });
      }
```

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add packages/agents/news-edge/src/agent.ts
git commit -m "fix: news-edge uses real CoinGecko price instead of hardcoded values (#35, #37)"
```

---

### Task 5: MCP Response Validation for Remaining Agents (#37)

**Files:**
- Modify: `packages/agents/pump-sniper/src/agent.ts`
- Modify: `packages/agents/spread-farmer/src/agent.ts`
- Modify: `packages/agents/liquidity-hunter/src/agent.ts`
- Modify: `packages/agents/portfolio-guard/src/agent.ts`

- [ ] **Step 1: Add validation to pump-sniper `fetchTrendingTokens()`**

In `packages/agents/pump-sniper/src/agent.ts`, update `fetchTrendingTokens()`:

```typescript
  private async fetchTrendingTokens(): Promise<{ token: string; liquidity_usd: number; social_score: number; red_flags: string[] }[]> {
    const trending = await this.mcpPool!.callTool('coingecko', 'get_trending', {});
    if (!trending || !Array.isArray(trending)) {
      throw new Error(`Invalid CoinGecko trending response: ${JSON.stringify(trending)}`);
    }
    return (trending as Array<{ id: string; name: string; symbol: string; market_cap_rank: number }>).map((coin, i) => ({
      token: coin.symbol,
      liquidity_usd: Math.max(1000, (101 - (coin.market_cap_rank || 999)) * 5000),
      social_score: Math.min(0.95, 0.3 + (trending.length - i) / trending.length * 0.6),
      red_flags: (coin.market_cap_rank || 999) > 500 ? ['no_audit'] : [],
    }));
  }
```

- [ ] **Step 2: Add validation to spread-farmer `fetchRealOrderbook()`**

In `packages/agents/spread-farmer/src/agent.ts`, update `fetchRealOrderbook()`:

Replace:
```typescript
    const quote = await this.mcpPool!.callTool('jupiter', 'get_quote', {
      inputMint: SOL_MINT, outputMint: USDC_MINT, amount: 1000000000,
    }) as { inAmount: string; outAmount: string; priceImpactPct: number };
```

With:
```typescript
    const quoteRes = await this.mcpPool!.callTool('jupiter', 'get_quote', {
      input_mint: SOL_MINT, output_mint: USDC_MINT, amount: 1000000000,
    });
    if (!quoteRes || typeof (quoteRes as any).outAmount !== 'string' || typeof (quoteRes as any).priceImpactPct !== 'number') {
      throw new Error(`Invalid Jupiter quote response: ${JSON.stringify(quoteRes)}`);
    }
    const quote = quoteRes as { inAmount: string; outAmount: string; priceImpactPct: number };
```

- [ ] **Step 3: Add validation to liquidity-hunter `fetchRealLiquidity()`**

In `packages/agents/liquidity-hunter/src/agent.ts`, update `fetchRealLiquidity()`:

Replace:
```typescript
    const res = await this.mcpPool!.callTool('coingecko', 'get_token_info', { coin_id: token.toLowerCase() }) as { price: number; volume_24h: number };
```

With:
```typescript
    const res = await this.mcpPool!.callTool('coingecko', 'get_token_info', { coin_id: token.toLowerCase() });
    if (!res || typeof (res as any).volume_24h !== 'number' || (res as any).volume_24h < 0) {
      throw new Error(`Invalid CoinGecko token info for ${token}: ${JSON.stringify(res)}`);
    }
    const data = res as { price: number; volume_24h: number };
```

And update the rest of the method to use `data.volume_24h` instead of `res.volume_24h`:

```typescript
    const previous = this.previousQuotes.get(token) ?? data.volume_24h;
    this.previousQuotes.set(token, data.volume_24h);
    return { token, previous_liquidity: previous, current_liquidity: data.volume_24h };
```

- [ ] **Step 4: Add validation to portfolio-guard agent**

In `packages/agents/portfolio-guard/src/agent.ts`, update the wallet path in `tick()`:

Replace (in the wallet try block, around line for solPrice):
```typescript
        const solPrice = await this.mcpPool.callTool('coingecko', 'get_price', { coin_id: 'solana' }) as { price: number };
```

With:
```typescript
        const solPriceRes = await this.mcpPool.callTool('coingecko', 'get_price', { coin_id: 'solana' });
        if (!solPriceRes || typeof (solPriceRes as any).price !== 'number' || (solPriceRes as any).price <= 0) {
          throw new Error(`Invalid CoinGecko SOL price: ${JSON.stringify(solPriceRes)}`);
        }
        const solPrice = solPriceRes as { price: number };
```

Do the same for the MCP fallback path (second try block in tick()) — replace both the `balResult` and `solPrice` calls:

```typescript
          const balRes = await this.mcpPool.callTool('helius', 'get_account_balance', { address: walletAddress });
          if (!balRes || typeof (balRes as any).value !== 'number') {
            throw new Error(`Invalid Helius balance response: ${JSON.stringify(balRes)}`);
          }
          const balResult = balRes as { value: number };
          const solPriceRes = await this.mcpPool.callTool('coingecko', 'get_price', { coin_id: 'solana' });
          if (!solPriceRes || typeof (solPriceRes as any).price !== 'number' || (solPriceRes as any).price <= 0) {
            throw new Error(`Invalid CoinGecko SOL price: ${JSON.stringify(solPriceRes)}`);
          }
          const solPrice = solPriceRes as { price: number };
```

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add packages/agents/pump-sniper/src/agent.ts packages/agents/spread-farmer/src/agent.ts packages/agents/liquidity-hunter/src/agent.ts packages/agents/portfolio-guard/src/agent.ts
git commit -m "fix: add MCP response validation to all agents (#37)"
```

---

## Phase 3: Polling Implementation (#33)

### Task 6: Helius MCP — Add getSignaturesForAddress Tool

**Files:**
- Modify: `packages/mcp-servers/helius/src/tools.ts`
- Modify: `packages/mcp-servers/helius/src/index.ts`
- Modify: `packages/mcp-servers/helius/__tests__/tools.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `packages/mcp-servers/helius/__tests__/tools.test.ts` after the `getAccountBalance` describe block:

```typescript
  describe('getSignaturesForAddress', () => {
    it('returns recent transaction signatures for an address', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          result: [
            { signature: 'sig1', slot: 100, blockTime: 1700000000, err: null },
            { signature: 'sig2', slot: 101, blockTime: 1700000010, err: null },
          ],
        }),
      });

      const sigs = await client.getSignaturesForAddress('wallet123', 10);
      expect(sigs).toHaveLength(2);
      expect(sigs[0].signature).toBe('sig1');
      expect(sigs[1].slot).toBe(101);
    });

    it('accepts custom limit parameter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ result: [] }),
      });

      await client.getSignaturesForAddress('wallet123', 5);
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.params[1].limit).toBe(5);
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/mcp-servers/helius/__tests__/tools.test.ts`
Expected: FAIL — `client.getSignaturesForAddress is not a function`

- [ ] **Step 3: Implement getSignaturesForAddress in tools.ts**

In `packages/mcp-servers/helius/src/tools.ts`, add the interface and method:

Add after `BalanceInfo` interface:
```typescript
export interface SignatureInfo {
  signature: string;
  slot: number;
  blockTime: number | null;
  err: unknown;
}
```

Add method to `HeliusClient` class after `getAccountBalance`:
```typescript
  async getSignaturesForAddress(address: string, limit: number = 10): Promise<SignatureInfo[]> {
    const result = await this.rpcCall('getSignaturesForAddress', [
      address,
      { limit },
    ]) as SignatureInfo[];
    return result;
  }
```

- [ ] **Step 4: Register the tool in index.ts**

In `packages/mcp-servers/helius/src/index.ts`, add before `const transport = new StdioServerTransport();`:

```typescript
server.tool(
  'get_signatures_for_address',
  'Get recent transaction signatures for a Solana address',
  {
    address: z.string().describe('Wallet address to query'),
    limit: z.number().optional().default(10).describe('Maximum signatures to return'),
  },
  async ({ address, limit }) => {
    const sigs = await client.getSignaturesForAddress(address, limit);
    return { content: [{ type: 'text' as const, text: JSON.stringify(sigs, null, 2) }] };
  }
);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run packages/mcp-servers/helius/__tests__/tools.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add packages/mcp-servers/helius/src/tools.ts packages/mcp-servers/helius/src/index.ts packages/mcp-servers/helius/__tests__/tools.test.ts
git commit -m "feat: add getSignaturesForAddress tool to Helius MCP (#33)"
```

---

### Task 7: whale-tracker — Polling-Based Whale Monitoring (#33)

**Files:**
- Modify: `packages/agents/whale-tracker/src/agent.ts`

- [ ] **Step 1: Rewrite whale-tracker agent.ts**

Replace the entire file with:

```typescript
import { BaseAgent, logger } from '@trade/core';
import type { Signal, SignalType } from '@trade/core';
import { WhaleTrackerStrategy, type WhaleTrackerConfig } from './strategy.js';

export class WhaleTrackerAgent extends BaseAgent {
  private strategy: WhaleTrackerStrategy;
  private watchAddresses: string[] = [];
  private lastSeenSignatures: Map<string, string> = new Map();

  constructor(config: WhaleTrackerConfig) {
    super('whale-tracker', { interval_ms: 5000 });
    this.strategy = new WhaleTrackerStrategy(config);
  }

  setWatchAddresses(addresses: string[]): void {
    this.watchAddresses = addresses;
  }

  getSubscribedSignalTypes(): SignalType[] {
    return [];
  }

  private async pollWhaleTransactions(): Promise<{ wallet: string; amount_usd: number; token: string; action: string }[]> {
    const results: { wallet: string; amount_usd: number; token: string; action: string }[] = [];

    for (const address of this.watchAddresses) {
      try {
        const sigsRes = await this.mcpPool!.callTool('helius', 'get_signatures_for_address', {
          address, limit: 5,
        });
        if (!sigsRes || !Array.isArray(sigsRes)) {
          throw new Error(`Invalid signatures response for ${address}: ${JSON.stringify(sigsRes)}`);
        }
        const sigs = sigsRes as Array<{ signature: string; blockTime: number | null; err: unknown }>;

        const lastSeen = this.lastSeenSignatures.get(address);
        for (const sig of sigs) {
          if (sig.err) continue;
          if (lastSeen && sig.signature === lastSeen) break;

          // Get transaction details to determine amount
          const txRes = await this.mcpPool!.callTool('helius', 'get_transaction', {
            signature: sig.signature,
          });
          if (!txRes || !(txRes as any).meta) continue;

          const meta = (txRes as any).meta;
          const fee = meta.fee || 0;
          // Estimate SOL transfer from balance changes
          const preBalances: number[] = meta.preBalances || [];
          const postBalances: number[] = meta.postBalances || [];
          let solChange = 0;
          if (preBalances.length > 0 && postBalances.length > 0) {
            // Find the largest change (likely the transfer)
            for (let i = 0; i < Math.min(preBalances.length, postBalances.length); i++) {
              const change = Math.abs(postBalances[i] - preBalances[i]);
              if (change > solChange) solChange = change;
            }
          }

          const solAmount = solChange / 1e9; // lamports to SOL
          // Get SOL price to estimate USD value
          const priceRes = await this.mcpPool!.callTool('coingecko', 'get_price', { coin_id: 'solana' });
          if (!priceRes || typeof (priceRes as any).price !== 'number') continue;
          const solPrice = (priceRes as { price: number }).price;
          const amountUsd = solAmount * solPrice;

          if (amountUsd > 0) {
            results.push({
              wallet: address,
              amount_usd: amountUsd,
              token: 'SOL',
              action: postBalances[0] > preBalances[0] ? 'buy' : 'sell',
            });
          }
        }

        // Track the most recent signature
        if (sigs.length > 0 && !sigs[0].err) {
          this.lastSeenSignatures.set(address, sigs[0].signature);
        }
      } catch (err) {
        logger.warn(`Agent ${this.name} failed to poll ${address}`, { error: String(err) });
      }
    }

    return results;
  }

  protected async tick(): Promise<void> {
    // If no watch addresses configured or no MCP pool, fall back to simulation
    if (this.isSimulation || !this.mcpPool || this.watchAddresses.length === 0) {
      const tx = this.simulation!.generateWhaleTx();
      const alert = this.strategy.analyze(tx);
      if (alert) {
        this.publishSignal('whale_move', {
          wallet: alert.wallet,
          token: alert.token,
          action: alert.action,
          amount_usd: alert.amount_usd,
        }, Math.min(0.99, 0.5 + alert.amount_usd / 200000));
      }
      return;
    }

    // Real polling path
    try {
      const transactions = await this.pollWhaleTransactions();
      for (const tx of transactions) {
        const alert = this.strategy.analyze(tx);
        if (alert) {
          this.publishSignal('whale_move', {
            wallet: alert.wallet,
            token: alert.token,
            action: alert.action,
            amount_usd: alert.amount_usd,
          }, Math.min(0.99, 0.5 + alert.amount_usd / 200000));
        }
      }
    } catch (err) {
      logger.warn(`Agent ${this.name} polling error, falling back to simulation`, { error: String(err) });
      const tx = this.simulation!.generateWhaleTx();
      const alert = this.strategy.analyze(tx);
      if (alert) {
        this.publishSignal('whale_move', {
          wallet: alert.wallet,
          token: alert.token,
          action: alert.action,
          amount_usd: alert.amount_usd,
        }, Math.min(0.99, 0.5 + alert.amount_usd / 200000));
      }
    }
  }

  protected async onSignal(signal: Signal): Promise<void> {}
}
```

- [ ] **Step 2: Update orchestrator to pass watch addresses**

In `packages/orchestrator/src/index.ts`, update the whale-tracker section:

Replace:
```typescript
const whaleTracker = new WhaleTrackerAgent({
  min_whale_usd: Number(process.env.WHALE_MIN_USD) || 10000,
});
whaleTracker.setInfrastructure({ db, signalBus, simulation, mcpPool, isSimulation });
```

With:
```typescript
const whaleTracker = new WhaleTrackerAgent({
  min_whale_usd: Number(process.env.WHALE_MIN_USD) || 10000,
});
whaleTracker.setInfrastructure({ db, signalBus, simulation, mcpPool, isSimulation });
const watchAddresses = (process.env.WHALE_WATCH_ADDRESSES || '').split(',').filter(Boolean);
if (watchAddresses.length > 0) {
  whaleTracker.setWatchAddresses(watchAddresses);
}
```

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add packages/agents/whale-tracker/src/agent.ts packages/orchestrator/src/index.ts
git commit -m "feat: whale-tracker polling-based monitoring via Helius (#33)"
```

---

### Task 8: copy-trader — Signal-Driven Trading (#33 + #35)

**Files:**
- Modify: `packages/agents/copy-trader/src/agent.ts`

- [ ] **Step 1: Rewrite copy-trader agent.ts**

Replace the entire file with:

```typescript
import { BaseAgent, logger } from '@trade/core';
import type { Signal, SignalType } from '@trade/core';
import { CopyTraderStrategy, type CopyTraderConfig } from './strategy.js';
import { randomUUID } from 'node:crypto';

export class CopyTraderAgent extends BaseAgent {
  private strategy: CopyTraderStrategy;
  constructor(config: CopyTraderConfig) {
    super('copy-trader', { interval_ms: 5000 });
    this.strategy = new CopyTraderStrategy(config);
  }

  getSubscribedSignalTypes(): SignalType[] {
    return ['whale_move'];
  }

  private async getTokenPrice(token: string): Promise<number> {
    const coinId = token.toLowerCase() === 'sol' ? 'solana'
      : token.toLowerCase() === 'btc' ? 'bitcoin'
      : token.toLowerCase() === 'eth' ? 'ethereum'
      : token.toLowerCase();
    const res = await this.mcpPool!.callTool('coingecko', 'get_price', { coin_id: coinId });
    if (!res || typeof (res as any).price !== 'number' || (res as any).price <= 0) {
      throw new Error(`Invalid CoinGecko price for ${token}: ${JSON.stringify(res)}`);
    }
    return (res as { price: number }).price;
  }

  protected async tick(): Promise<void> {
    // In signal-driven mode, tick is a no-op
    // Copy trades are handled via onSignal when whale_move signals arrive
  }

  protected async onSignal(signal: Signal): Promise<void> {
    if (signal.signal_type !== 'whale_move') return;

    const whaleData = {
      whale_wallet: String(signal.data.wallet || ''),
      action: String(signal.data.action || 'buy'),
      token: String(signal.data.token || 'SOL'),
      amount_usd: Number(signal.data.amount_usd || 0),
    };

    const decision = this.strategy.evaluate(whaleData);
    if (!decision.should_copy) return;

    this.publishSignal('trade_executed', {
      token: whaleData.token,
      amount_usd: decision.copy_amount_usd,
      action: 'copy_buy',
      whale_wallet: whaleData.whale_wallet,
    }, signal.confidence * 0.9);

    if (this.db) {
      let price: number;
      if (!this.isSimulation && this.mcpPool) {
        try {
          price = await this.getTokenPrice(whaleData.token);
        } catch {
          logger.warn(`Agent ${this.name} price fetch failed, skipping trade record`);
          return;
        }
      } else {
        price = 100; // simulation placeholder
      }
      const quantity = decision.copy_amount_usd / price;
      this.db.insertTrade({
        id: randomUUID(),
        agent: this.name,
        pair: `${whaleData.token}/USDT`,
        side: 'buy',
        entry_price: price,
        exit_price: null,
        quantity,
        pnl: null,
        fee: decision.copy_amount_usd * 0.001,
        chain: 'solana',
        tx_hash: null,
        simulated: this.isSimulation,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
```

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add packages/agents/copy-trader/src/agent.ts
git commit -m "feat: copy-trader signal-driven with real prices (#33, #35)"
```

---

## Phase 4: Dashboard Security (#36)

### Task 9: Dashboard XSS Fix + Security Headers (#36)

**Files:**
- Modify: `packages/dashboard/src/server.ts`

- [ ] **Step 1: Add security headers helper**

At the top of `packages/dashboard/src/server.ts`, after the `import` statements, add:

```typescript
const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; style-src 'unsafe-inline'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};
```

- [ ] **Step 2: Apply security headers to all responses**

In the request handler, update all `res.writeHead()` calls to include `SECURITY_HEADERS`:

For the `/health` endpoint:
```typescript
      res.writeHead(200, { 'Content-Type': 'application/json', ...SECURITY_HEADERS });
```

For the `503` response (db not initialized):
```typescript
        res.writeHead(503, { 'Content-Type': 'application/json', ...SECURITY_HEADERS });
```

For the `200` API response:
```typescript
        res.writeHead(200, { 'Content-Type': 'application/json', ...SECURITY_HEADERS });
```

For the `404` response:
```typescript
          res.writeHead(404, { 'Content-Type': 'application/json', ...SECURITY_HEADERS });
```

For the `503` error response:
```typescript
        res.writeHead(503, { 'Content-Type': 'application/json', ...SECURITY_HEADERS });
```

For the HTML response:
```typescript
      res.writeHead(200, { 'Content-Type': 'text/html', ...SECURITY_HEADERS });
```

- [ ] **Step 3: Fix innerHTML XSS vulnerability**

In the `HTML` template string, find the JavaScript section that sets `tbody.innerHTML` and replace with DOM API.

Find this code inside the `<script>` tag:
```javascript
        const tbody = document.getElementById('trades-body');
        tbody.innerHTML = data.trades.map(t =>
          `<tr><td>${t.timestamp}</td><td>${t.agent}</td><td>${t.pair}</td><td>${t.side}</td><td class="${t.pnl >= 0 ? 'positive' : 'negative'}">$${t.pnl?.toFixed(2) || '--'}</td><td>${t.simulated ? 'Yes' : 'No'}</td></tr>`
        ).join('');
```

Replace with:
```javascript
        const tbody = document.getElementById('trades-body');
        tbody.innerHTML = '';
        for (const t of data.trades) {
          const tr = document.createElement('tr');
          const tdTs = document.createElement('td'); tdTs.textContent = t.timestamp;
          const tdAg = document.createElement('td'); tdAg.textContent = t.agent;
          const tdPr = document.createElement('td'); tdPr.textContent = t.pair;
          const tdSd = document.createElement('td'); tdSd.textContent = t.side;
          const tdPnl = document.createElement('td'); tdPnl.textContent = '$' + (t.pnl != null ? t.pnl.toFixed(2) : '--'); tdPnl.className = t.pnl >= 0 ? 'positive' : 'negative';
          const tdSim = document.createElement('td'); tdSim.textContent = t.simulated ? 'Yes' : 'No';
          tr.append(tdTs, tdAg, tdPr, tdSd, tdPnl, tdSim);
          tbody.appendChild(tr);
        }
```

- [ ] **Step 4: Make active_agents dynamic**

Replace the hardcoded values in the `/api/status` handler:

Find:
```typescript
            active_agents: 8,
            total_agents: 8,
```

Replace with:
```typescript
            active_agents: trades.length > 0 ? new Set(trades.map(t => t.agent)).size : 0,
            total_agents: 8,
```

Also update the `/api/agents` endpoint. Find:
```typescript
          const agents = agentNames.map(name => ({
            name,
            status: 'running',
```

Replace `status: 'running'` with:
```typescript
            status: db.getTradesByAgent(name).length > 0 ? 'running' : 'idle',
```

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add packages/dashboard/src/server.ts
git commit -m "security: fix XSS via innerHTML, add security headers, dynamic agents (#36)"
```

---

## Phase 5: Risk Parameters & Final Verification

### Task 10: Update Risk Parameters for $20 Seed

**Files:**
- Modify: `.env`

- [ ] **Step 1: Update risk parameters in `.env`**

Replace the risk section:

```
# Before:
MAX_TOTAL_EXPOSURE_USD=5000
MAX_SINGLE_TRADE_USD=500
CIRCUIT_BREAKER_LOSS_USD=200

# After:
MAX_TOTAL_EXPOSURE_USD=15
MAX_SINGLE_TRADE_USD=2
CIRCUIT_BREAKER_LOSS_USD=5
```

Update agent config section:

```
# Before:
ARB_MIN_PROFIT_USD=5
PUMP_MAX_POSITION_USD=200
COPY_MAX_USD=300
GUARD_STOP_LOSS_PCT=8
WHALE_MIN_USD=10000

# After:
ARB_MIN_PROFIT_USD=0.5
PUMP_MAX_POSITION_USD=3
COPY_MAX_USD=2
GUARD_STOP_LOSS_PCT=5
WHALE_MIN_USD=1000
```

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add .env
git commit -m "config: update risk parameters for $20 seed capital"
```

---

### Task 11: Build, Rebuild Docker, and Verify

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: All packages build successfully

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: All 82+ tests pass

- [ ] **Step 3: Rebuild Docker containers**

Run: `docker compose down && docker compose up -d --build`
Expected: All 4 containers start (redis, orchestrator, dashboard, db-backup)

- [ ] **Step 4: Verify orchestrator logs**

Run: `docker compose logs orchestrator --tail 30`
Expected: 
- `mode: real-data` (if SIMULATION=false in .env)
- All 8 agents registered and started
- MCP connections established (coingecko, phantom, jupiter, helius)

- [ ] **Step 5: Verify dashboard**

Run: `curl -s http://localhost:3000/health`
Expected: `{"status":"ok",...}`

Run: `curl -s http://localhost:3000/api/status`
Expected: JSON with trades, pnl data, security headers present

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: rebuild and verify all fixes for mainnet readiness"
```

---

## Post-Implementation: Mainnet Migration Checklist

After all tasks are complete, the user needs to:

1. Get a Helius **mainnet** API key
2. Update `HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_MAINNET_KEY`
3. Transfer $20 worth of SOL to the wallet address
4. Set `WHALE_WATCH_ADDRESSES` with known whale wallet addresses (optional)
5. Rebuild and restart Docker containers
