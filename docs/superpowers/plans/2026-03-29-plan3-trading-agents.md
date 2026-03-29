# Plan 3: Trading Agents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build 8 trading agents (arb-scanner, pump-sniper, spread-farmer, whale-tracker, copy-trader, news-edge, liquidity-hunter, portfolio-guard) with a shared base class, signal bus integration, and simulation support.

**Architecture:** Each agent extends a `BaseAgent` class that provides lifecycle management (start/stop), signal bus integration (publish/subscribe), trade logging, and simulation mode. Agent-specific logic lives in a `Strategy` class. The agent main loop calls `strategy.tick()` on an interval.

**Tech Stack:** TypeScript, `@trade/core` (types, db, signal-bus, logger, config), `vitest`

---

## File Structure Per Agent

```
packages/agents/<name>/
├── src/
│   ├── index.ts          # Agent entry point + CLI
│   ├── agent.ts          # Agent class (extends BaseAgent)
│   └── strategy.ts       # Strategy logic
├── __tests__/
│   └── strategy.test.ts  # Unit tests for strategy
├── package.json
└── tsconfig.json
```

---

### Task 1: BaseAgent in @trade/core

**Files:**
- Create: `packages/core/src/base-agent.ts`
- Modify: `packages/core/src/index.ts` (export BaseAgent)
- Create: `packages/core/__tests__/base-agent.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/core/__tests__/base-agent.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseAgent } from '../src/base-agent.js';
import type { Signal } from '../src/types.js';

class TestAgent extends BaseAgent {
  tickCount = 0;
  signalsReceived: Signal[] = [];

  constructor() {
    super('test-agent', { interval_ms: 100 });
  }

  protected async tick(): Promise<void> {
    this.tickCount++;
  }

  protected async onSignal(signal: Signal): Promise<void> {
    this.signalsReceived.push(signal);
  }
}

describe('BaseAgent', () => {
  let agent: TestAgent;

  beforeEach(() => { agent = new TestAgent(); });
  afterEach(() => { agent.stop(); });

  it('starts and runs tick on interval', async () => {
    await agent.start();
    await new Promise((r) => setTimeout(r, 350));
    expect(agent.tickCount).toBeGreaterThanOrEqual(3);
  });

  it('stops running when stopped', async () => {
    await agent.start();
    await new Promise((r) => setTimeout(r, 250));
    agent.stop();
    const count = agent.tickCount;
    await new Promise((r) => setTimeout(r, 250));
    expect(agent.tickCount).toBe(count);
  });

  it('has running state', async () => {
    expect(agent.getStatus()).toBe('idle');
    await agent.start();
    expect(agent.getStatus()).toBe('running');
    agent.stop();
    expect(agent.getStatus()).toBe('stopped');
  });

  it('publishes signals', async () => {
    const handler = vi.fn();
    agent.onSignal = handler;
    // Signal is published via publishSignal method
    agent.publishSignal('price_gap', { pair: 'SOL/USDT', gap_pct: 2.5 }, 0.8);
    // onSignal would be called if subscriber exists
    expect(handler).not.toHaveBeenCalled(); // no subscriber set up
  });

  it('generates unique signal IDs', async () => {
    const s1 = agent.publishSignal('test', {}, 0.5);
    const s2 = agent.publishSignal('test', {}, 0.5);
    expect(s1.id).not.toBe(s2.id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/__tests__/base-agent.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

`packages/core/src/base-agent.ts`:
```typescript
import type { Signal, SignalType, AgentStatus } from './types.js';
import { logger } from './logger.js';
import { crypto } from 'node:crypto';

export abstract class BaseAgent {
  protected name: string;
  protected config: { interval_ms: number };
  private timer: ReturnType<typeof setInterval> | null = null;
  private status: AgentStatus = 'idle';

  constructor(name: string, config: { interval_ms: number }) {
    this.name = name;
    this.config = config;
  }

  async start(): Promise<void> {
    if (this.status === 'running') return;
    this.status = 'running';
    logger.info(`Agent ${this.name} started`, { interval_ms: this.config.interval_ms });
    this.timer = setInterval(() => {
      this.tick().catch((err) => {
        logger.error(`Agent ${this.name} tick error`, { error: String(err) });
        this.status = 'error';
      });
    }, this.config.interval_ms);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.status = 'stopped';
    logger.info(`Agent ${this.name} stopped`);
  }

  getStatus(): AgentStatus {
    return this.status;
  }

  protected abstract tick(): Promise<void>;

  protected abstract onSignal(signal: Signal): Promise<void>;

  publishSignal(type: SignalType, data: Record<string, unknown>, confidence: number): Signal {
    const signal: Signal = {
      id: crypto.randomUUID(),
      source_agent: this.name,
      signal_type: type,
      data,
      confidence,
      timestamp: new Date().toISOString(),
    };
    logger.debug(`Agent ${this.name} published signal`, { type, signal_id: signal.id });
    return signal;
  }
}
```

Modify `packages/core/src/index.ts` — add export:
```typescript
export { BaseAgent } from './base-agent.js';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/core/__tests__/base-agent.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/base-agent.ts packages/core/src/index.ts packages/core/__tests__/base-agent.test.ts
git commit -m "feat(core): add BaseAgent abstract class for trading agents"
```

---

### Task 2: arb-scanner — DEX Arbitrage Agent

**Files:**
- Create: `packages/agents/arb-scanner/package.json`
- Create: `packages/agents/arb-scanner/tsconfig.json`
- Create: `packages/agents/arb-scanner/src/strategy.ts`
- Create: `packages/agents/arb-scanner/src/agent.ts`
- Create: `packages/agents/arb-scanner/src/index.ts`
- Create: `packages/agents/arb-scanner/__tests__/strategy.test.ts`

- [ ] **Step 1: Write failing test**

`packages/agents/arb-scanner/__tests__/strategy.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { ArbStrategy } from '../src/strategy.js';

describe('ArbStrategy', () => {
  it('detects price gap above threshold', () => {
    const strategy = new ArbStrategy({ min_profit_usd: 5, chains: ['solana', 'bsc'] });
    const opportunity = strategy.analyze({
      pair: 'SOL/USDT',
      buyPrice: 150.0,
      sellPrice: 151.2,
      quantity: 10,
    });
    expect(opportunity).not.toBeNull();
    expect(opportunity!.profit).toBe(12);
    expect(opportunity!.profit > 5).toBe(true);
  });

  it('ignores price gap below threshold', () => {
    const strategy = new ArbStrategy({ min_profit_usd: 5, chains: ['solana'] });
    const opportunity = strategy.analyze({
      pair: 'SOL/USDT',
      buyPrice: 150.0,
      sellPrice: 150.3,
      quantity: 10,
    });
    expect(opportunity).toBeNull();
  });

  it('returns null for negative gap', () => {
    const strategy = new ArbStrategy({ min_profit_usd: 5, chains: ['solana'] });
    const opportunity = strategy.analyze({
      pair: 'SOL/USDT',
      buyPrice: 151.0,
      sellPrice: 150.0,
      quantity: 10,
    });
    expect(opportunity).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/agents/arb-scanner/__tests__/strategy.test.ts`

- [ ] **Step 3: Write implementation**

`packages/agents/arb-scanner/src/strategy.ts`:
```typescript
export interface ArbConfig {
  min_profit_usd: number;
  chains: string[];
}

export interface ArbOpportunity {
  pair: string;
  buyPrice: number;
  sellPrice: number;
  quantity: number;
  profit: number;
}

export class ArbStrategy {
  private config: ArbConfig;

  constructor(config: ArbConfig) {
    this.config = config;
  }

  analyze(prices: { pair: string; buyPrice: number; sellPrice: number; quantity: number }): ArbOpportunity | null {
    const profit = (prices.sellPrice - prices.buyPrice) * prices.quantity;
    if (profit >= this.config.min_profit_usd) {
      return {
        pair: prices.pair,
        buyPrice: prices.buyPrice,
        sellPrice: prices.sellPrice,
        quantity: prices.quantity,
        profit,
      };
    }
    return null;
  }
}
```

`packages/agents/arb-scanner/src/agent.ts`:
```typescript
import { BaseAgent } from '@trade/core';
import type { Signal } from '@trade/core';
import { ArbStrategy, type ArbConfig } from './strategy.js';

export class ArbScannerAgent extends BaseAgent {
  private strategy: ArbStrategy;

  constructor(config: ArbConfig) {
    super('arb-scanner', { interval_ms: 3000 });
    this.strategy = new ArbStrategy(config);
  }

  protected async tick(): Promise<void> {
    // In production: fetch prices from helius/jupiter/1inch MCP servers
    // For now: strategy is ready for data injection
  }

  protected async onSignal(signal: Signal): Promise<void> {
    if (signal.signal_type === 'whale_move') {
      // Whale move may create arb opportunity
      this.publishSignal('price_gap', { source: 'whale', data: signal.data }, signal.confidence * 0.8);
    }
  }
}
```

`packages/agents/arb-scanner/src/index.ts`:
```typescript
#!/usr/bin/env node
import { ArbScannerAgent } from './agent.js';

const config = {
  min_profit_usd: Number(process.env.ARB_MIN_PROFIT_USD) || 5,
  chains: (process.env.ARB_CHAINS || 'solana,bsc').split(','),
};

const agent = new ArbScannerAgent(config);
agent.start().catch(console.error);

process.on('SIGTERM', () => agent.stop());
process.on('SIGINT', () => agent.stop());
```

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

---

### Task 3: pump-sniper — New Token Discovery Agent

- [ ] **Step 1: Write failing test**

`packages/agents/pump-sniper/__tests__/strategy.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { PumpSniperStrategy } from '../src/strategy.js';

describe('PumpSniperStrategy', () => {
  it('approves token with good liquidity and no red flags', () => {
    const strategy = new PumpSniperStrategy({ max_position_usd: 200, max_open_positions: 3 });
    const decision = strategy.evaluate({
      token: 'PEPE',
      liquidity_usd: 50000,
      social_score: 0.8,
      red_flags: [],
    });
    expect(decision.should_buy).toBe(true);
  });

  it('rejects token with low liquidity', () => {
    const strategy = new PumpSniperStrategy({ max_position_usd: 200, max_open_positions: 3 });
    const decision = strategy.evaluate({
      token: 'SCAM',
      liquidity_usd: 500,
      social_score: 0.5,
      red_flags: [],
    });
    expect(decision.should_buy).toBe(false);
  });

  it('rejects token with red flags', () => {
    const strategy = new PumpSniperStrategy({ max_position_usd: 200, max_open_positions: 3 });
    const decision = strategy.evaluate({
      token: 'RUG',
      liquidity_usd: 100000,
      social_score: 0.3,
      red_flags: ['contract_mint_disabled', 'holder_concentration'],
    });
    expect(decision.should_buy).toBe(false);
  });
});
```

- [ ] **Step 2-5: Implement, test, commit** (same pattern as above)

---

### Task 4: spread-farmer — Polymarket Spread Harvesting

- [ ] **Step 1: Write failing test**

`packages/agents/spread-farmer/__tests__/strategy.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { SpreadFarmerStrategy } from '../src/strategy.js';

describe('SpreadFarmerStrategy', () => {
  it('identifies profitable spread', () => {
    const strategy = new SpreadFarmerStrategy({ min_spread_pct: 2, max_positions: 10 });
    const decision = strategy.evaluate({
      market: 'Will BTC hit 100k?',
      best_bid: 0.45,
      best_ask: 0.55,
      quantity: 100,
    });
    expect(decision.should_trade).toBe(true);
    expect(decision.spread_pct).toBeCloseTo(10, 0);
  });

  it('ignores tight spread', () => {
    const strategy = new SpreadFarmerStrategy({ min_spread_pct: 2, max_positions: 10 });
    const decision = strategy.evaluate({
      market: 'ETH above 5k?',
      best_bid: 0.49,
      best_ask: 0.51,
      quantity: 100,
    });
    expect(decision.should_trade).toBe(false);
  });
});
```

- [ ] **Step 2-5: Implement, test, commit**

---

### Task 5: whale-tracker — Large Wallet Monitoring

- [ ] **Step 1: Write failing test**

`packages/agents/whale-tracker/__tests__/strategy.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { WhaleTrackerStrategy } from '../src/strategy.js';

describe('WhaleTrackerStrategy', () => {
  it('flags whale transaction above threshold', () => {
    const strategy = new WhaleTrackerStrategy({ min_whale_usd: 10000 });
    const alert = strategy.analyze({
      wallet: '0xwhale123',
      amount_usd: 50000,
      token: 'SOL',
      action: 'buy',
    });
    expect(alert).not.toBeNull();
    expect(alert!.amount_usd).toBe(50000);
  });

  it('ignores small transaction', () => {
    const strategy = new WhaleTrackerStrategy({ min_whale_usd: 10000 });
    const alert = strategy.analyze({
      wallet: '0xs mall',
      amount_usd: 500,
      token: 'SOL',
      action: 'sell',
    });
    expect(alert).toBeNull();
  });
});
```

- [ ] **Step 2-5: Implement, test, commit**

---

### Task 6: copy-trader — Mirror Whale Positions

- [ ] **Step 1: Write failing test**

`packages/agents/copy-trader/__tests__/strategy.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { CopyTraderStrategy } from '../src/strategy.js';

describe('CopyTraderStrategy', () => {
  it('decides to copy whale buy signal', () => {
    const strategy = new CopyTraderStrategy({ max_copy_usd: 300, copy_delay_ms: 2000 });
    const decision = strategy.evaluate({
      whale_wallet: '0xwhale',
      action: 'buy',
      token: 'SOL',
      amount_usd: 50000,
    });
    expect(decision.should_copy).toBe(true);
    expect(decision.copy_amount_usd).toBeLessThanOrEqual(300);
  });

  it('ignores sell signals', () => {
    const strategy = new CopyTraderStrategy({ max_copy_usd: 300, copy_delay_ms: 2000 });
    const decision = strategy.evaluate({
      whale_wallet: '0xwhale',
      action: 'sell',
      token: 'SOL',
      amount_usd: 50000,
    });
    expect(decision.should_copy).toBe(false);
  });
});
```

- [ ] **Step 2-5: Implement, test, commit**

---

### Task 7: news-edge — News Sentiment Entry

- [ ] **Step 1: Write failing test**

`packages/agents/news-edge/__tests__/strategy.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { NewsEdgeStrategy } from '../src/strategy.js';

describe('NewsEdgeStrategy', () => {
  it('enters when sentiment exceeds threshold', () => {
    const strategy = new NewsEdgeStrategy({ sentiment_threshold: 0.7 });
    const decision = strategy.evaluate({
      token: 'BTC',
      sentiment_score: 0.85,
      fear_greed: 75,
      source: 'github-sentiment-repo',
    });
    expect(decision.should_enter).toBe(true);
  });

  it('skips when sentiment is low', () => {
    const strategy = new NewsEdgeStrategy({ sentiment_threshold: 0.7 });
    const decision = strategy.evaluate({
      token: 'BTC',
      sentiment_score: 0.4,
      fear_greed: 30,
      source: 'github-sentiment-repo',
    });
    expect(decision.should_enter).toBe(false);
  });
});
```

- [ ] **Step 2-5: Implement, test, commit**

---

### Task 8: liquidity-hunter — LP Change Detection

- [ ] **Step 1: Write failing test**

`packages/agents/liquidity-hunter/__tests__/strategy.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { LiquidityHunterStrategy } from '../src/strategy.js';

describe('LiquidityHunterStrategy', () => {
  it('flags significant liquidity increase', () => {
    const strategy = new LiquidityHunterStrategy({ min_liquidity_change_pct: 5 });
    const alert = strategy.analyze({
      token: 'SOL',
      previous_liquidity: 100000,
      current_liquidity: 120000,
    });
    expect(alert).not.toBeNull();
    expect(alert!.change_pct).toBeCloseTo(20, 0);
  });

  it('ignores small liquidity changes', () => {
    const strategy = new LiquidityHunterStrategy({ min_liquidity_change_pct: 5 });
    const alert = strategy.analyze({
      token: 'SOL',
      previous_liquidity: 100000,
      current_liquidity: 102000,
    });
    expect(alert).toBeNull();
  });
});
```

- [ ] **Step 2-5: Implement, test, commit**

---

### Task 9: portfolio-guard — Risk Monitoring & Rebalancing

- [ ] **Step 1: Write failing test**

`packages/agents/portfolio-guard/__tests__/strategy.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { PortfolioGuardStrategy } from '../src/strategy.js';

describe('PortfolioGuardStrategy', () => {
  it('triggers stop-loss when position drops below threshold', () => {
    const strategy = new PortfolioGuardStrategy({ stop_loss_pct: 8, rebalance_threshold_pct: 5 });
    const action = strategy.evaluate({
      positions: [{ token: 'SOL', entry_price: 150, current_price: 135, allocation_pct: 25 }],
      total_value_usd: 5000,
      max_exposure_usd: 5000,
    });
    expect(action.stop_loss_triggered).toBe(true);
    expect(action.tokens_to_sell).toContain('SOL');
  });

  it('does nothing when portfolio is healthy', () => {
    const strategy = new PortfolioGuardStrategy({ stop_loss_pct: 8, rebalance_threshold_pct: 5 });
    const action = strategy.evaluate({
      positions: [{ token: 'SOL', entry_price: 150, current_price: 148, allocation_pct: 20 }],
      total_value_usd: 3000,
      max_exposure_usd: 5000,
    });
    expect(action.stop_loss_triggered).toBe(false);
    expect(action.tokens_to_sell).toHaveLength(0);
  });

  it('flags over-concentration', () => {
    const strategy = new PortfolioGuardStrategy({ stop_loss_pct: 8, rebalance_threshold_pct: 5 });
    const action = strategy.evaluate({
      positions: [
        { token: 'SOL', entry_price: 150, current_price: 155, allocation_pct: 60 },
        { token: 'ETH', entry_price: 3000, current_price: 3100, allocation_pct: 40 },
      ],
      total_value_usd: 5000,
      max_exposure_usd: 5000,
    });
    expect(action.rebalance_needed).toBe(true);
    expect(action.tokens_to_sell).toContain('SOL');
  });
});
```

- [ ] **Step 2-5: Implement, test, commit**

---

### Task 10: npm install and Full Test Suite

- [ ] **Step 1: Install dependencies**

Run: `npm install`

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install all agent dependencies"
```
