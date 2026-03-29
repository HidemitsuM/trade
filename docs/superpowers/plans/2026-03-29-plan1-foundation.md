# MCP Trading System - Plan 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the project scaffold, core shared library, database, signal bus, and a working MCP server template that all subsequent plans build upon.

**Architecture:** Monorepo with npm workspaces. Shared `core` package provides types, config, DB, signal bus, and logger. Each MCP server and agent is its own workspace package. Docker Compose runs Redis and the orchestrator.

**Tech Stack:** TypeScript, Node.js, `@modelcontextprotocol/sdk`, `better-sqlite3`, `ioredis`, `zod`, `vitest`, Docker Compose.

---

## File Structure Map

Files created in this plan:

```
trade/
├── package.json                          # Workspace root
├── tsconfig.json                         # Root tsconfig
├── .gitignore
├── .env.example
├── docker-compose.yml
├── vitest.config.ts
├── config/
│   └── default.yaml
├── packages/
│   ├── core/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── types.ts
│   │   │   ├── config.ts
│   │   │   ├── db.ts
│   │   │   ├── signal-bus.ts
│   │   │   └── logger.ts
│   │   └── __tests__/
│   │       ├── config.test.ts
│   │       ├── db.test.ts
│   │       └── signal-bus.test.ts
│   └── mcp-servers/
│       └── risk-manager/
│           ├── package.json
│           ├── tsconfig.json
│           ├── src/
│           │   ├── index.ts
│           │   └── tools.ts
│           └── __tests__/
│               └── tools.test.ts
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Create root package.json with workspace config**

```json
{
  "name": "trade",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "workspaces": [
    "packages/core",
    "packages/mcp-servers/*",
    "packages/agents/*",
    "packages/orchestrator",
    "packages/dashboard"
  ],
  "scripts": {
    "build": "npm workspaces run build",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint packages/*/src"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.0.0",
    "@types/node": "^22.0.0"
  }
}
```

- [ ] **Step 2: Create root tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "exclude": ["node_modules", "dist", "__tests__"]
}
```

- [ ] **Step 3: Create .gitignore**

```
node_modules/
dist/
data/*.db
.env
*.log
.DS_Store
coverage/
```

- [ ] **Step 4: Create .env.example**

```
# MCP Server Keys
HELIUS_API_KEY=
DUNE_API_KEY=
CMC_API_KEY=
COINGECKO_API_KEY=
PHANTOM_PRIVATE_KEY=
BSC_RPC_URL=https://bsc-dataseed.binance.org
POLYMARKET_API_KEY=
POLYMARKET_PRIVATE_KEY=

# Infrastructure
REDIS_URL=redis://localhost:6379
SIMULATION=true
```

- [ ] **Step 5: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['packages/**/__tests__/**/*.test.ts'],
  },
});
```

- [ ] **Step 6: Create config/default.yaml**

```yaml
orchestrator:
  max_concurrent_agents: 8
  signal_timeout_ms: 5000
  heartbeat_interval_ms: 10000

risk:
  max_total_exposure_usd: 5000
  max_single_trade_usd: 500
  max_drawdown_pct: 10
  circuit_breaker_loss_usd: 200
  daily_loss_limit_usd: 300

simulation:
  enabled: true
  slippage_pct: 0.5
  fee_pct: 0.3
```

- [ ] **Step 7: Create directories**

```bash
mkdir -p packages/core/src packages/core/__tests__
mkdir -p packages/mcp-servers/risk-manager/src packages/mcp-servers/risk-manager/__tests__
mkdir -p config data
```

- [ ] **Step 8: Commit scaffold**

```bash
git add -A
git commit -m "feat: scaffold monorepo project structure"
```

---

### Task 2: Core Package — Types

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/types.ts`
- Create: `packages/core/src/index.ts`

- [ ] **Step 1: Create packages/core/package.json**

```json
{
  "name": "@trade/core",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "ioredis": "^5.4.0",
    "yaml": "^2.6.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create packages/core/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "__tests__"]
}
```

- [ ] **Step 3: Write types.ts**

```typescript
// --- Trade types ---
export type TradeSide = 'buy' | 'sell';

export interface TradeLog {
  id: string;
  agent: string;
  pair: string;
  side: TradeSide;
  entry_price: number;
  exit_price: number | null;
  quantity: number;
  pnl: number | null;
  fee: number;
  chain: string;
  tx_hash: string | null;
  simulated: boolean;
  timestamp: string;
}

// --- Signal types ---
export type SignalType =
  | 'price_gap'
  | 'new_token'
  | 'whale_move'
  | 'liquidity_change'
  | 'sentiment_shift'
  | 'spread_opportunity'
  | 'risk_breach'
  | 'trade_executed';

export interface Signal {
  id: string;
  source_agent: string;
  signal_type: SignalType;
  data: Record<string, unknown>;
  confidence: number;
  timestamp: string;
}

// --- Agent types ---
export type AgentStatus = 'idle' | 'running' | 'error' | 'stopped';

export interface AgentState {
  id: string;
  agent_name: string;
  status: AgentStatus;
  config: Record<string, unknown>;
  last_heartbeat: string | null;
  total_pnl: number;
  trade_count: number;
}

// --- Wallet types ---
export interface WalletState {
  id: string;
  chain: string;
  address: string;
  balances: Record<string, number>;
  updated_at: string;
}

// --- Risk types ---
export type RiskMetric =
  | 'total_exposure'
  | 'single_trade'
  | 'daily_loss'
  | 'drawdown'
  | 'circuit_breaker';

export interface RiskState {
  metric: RiskMetric;
  value: number;
  threshold: number;
  breached: boolean;
  timestamp: string;
}

// --- Config types ---
export interface RiskConfig {
  max_total_exposure_usd: number;
  max_single_trade_usd: number;
  max_drawdown_pct: number;
  circuit_breaker_loss_usd: number;
  daily_loss_limit_usd: number;
}

export interface SimulationConfig {
  enabled: boolean;
  slippage_pct: number;
  fee_pct: number;
}

export interface OrchestratorConfig {
  max_concurrent_agents: number;
  signal_timeout_ms: number;
  heartbeat_interval_ms: number;
}

export interface AppConfig {
  orchestrator: OrchestratorConfig;
  risk: RiskConfig;
  simulation: SimulationConfig;
}
```

- [ ] **Step 4: Write index.ts (barrel export)**

```typescript
export * from './types.js';
export { loadConfig } from './config.js';
export { Database } from './db.js';
export { SignalBus } from './signal-bus.js';
export { logger } from './logger.js';
```

- [ ] **Step 5: Install dependencies**

```bash
npm install
```

- [ ] **Step 6: Verify build**

```bash
cd packages/core && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(core): add shared types and package config"
```

---

### Task 3: Core Package — Config Loader

**Files:**
- Create: `packages/core/src/config.ts`
- Create: `packages/core/__tests__/config.test.ts`

- [ ] **Step 1: Write failing test for config loader**

```typescript
// packages/core/__tests__/config.test.ts
import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('loads default config from yaml', async () => {
    const config = await loadConfig('../../config/default.yaml');
    expect(config.risk.max_total_exposure_usd).toBe(5000);
    expect(config.risk.max_single_trade_usd).toBe(500);
    expect(config.simulation.enabled).toBe(true);
    expect(config.orchestrator.max_concurrent_agents).toBe(8);
  });

  it('throws on missing file', async () => {
    await expect(loadConfig('nonexistent.yaml')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run packages/core/__tests__/config.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement config.ts**

```typescript
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { AppConfig } from './types.js';

export async function loadConfig(configPath: string): Promise<AppConfig> {
  const fullPath = resolve(configPath);
  const raw = readFileSync(fullPath, 'utf-8');
  const parsed = parseYaml(raw);

  if (!parsed.orchestrator || !parsed.risk || !parsed.simulation) {
    throw new Error('Invalid config: missing required sections (orchestrator, risk, simulation)');
  }

  return {
    orchestrator: {
      max_concurrent_agents: parsed.orchestrator.max_concurrent_agents,
      signal_timeout_ms: parsed.orchestrator.signal_timeout_ms,
      heartbeat_interval_ms: parsed.orchestrator.heartbeat_interval_ms,
    },
    risk: {
      max_total_exposure_usd: parsed.risk.max_total_exposure_usd,
      max_single_trade_usd: parsed.risk.max_single_trade_usd,
      max_drawdown_pct: parsed.risk.max_drawdown_pct,
      circuit_breaker_loss_usd: parsed.risk.circuit_breaker_loss_usd,
      daily_loss_limit_usd: parsed.risk.daily_loss_limit_usd,
    },
    simulation: {
      enabled: parsed.simulation.enabled,
      slippage_pct: parsed.simulation.slippage_pct,
      fee_pct: parsed.simulation.fee_pct,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run packages/core/__tests__/config.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(core): add config loader with yaml parsing"
```

---

### Task 4: Core Package — Logger

**Files:**
- Create: `packages/core/src/logger.ts`

- [ ] **Step 1: Implement logger.ts**

```typescript
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private minLevel: LogLevel = 'info';

  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.minLevel];
  }

  private format(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
    const ts = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${ts}] ${level.toUpperCase()} ${message}${metaStr}`;
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('debug')) console.debug(this.format('debug', message, meta));
  }

  info(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('info')) console.info(this.format('info', message, meta));
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('warn')) console.warn(this.format('warn', message, meta));
  }

  error(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('error')) console.error(this.format('error', message, meta));
  }
}

export const logger = new Logger();
```

- [ ] **Step 2: Verify build**

```bash
cd packages/core && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(core): add structured logger"
```

---

### Task 5: Core Package — Database

**Files:**
- Create: `packages/core/src/db.ts`
- Create: `packages/core/__tests__/db.test.ts`

- [ ] **Step 1: Write failing test for Database**

```typescript
// packages/core/__tests__/db.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../src/db.js';
import type { TradeLog, Signal, AgentState } from '../src/types.js';

describe('Database', () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.initialize();
  });

  afterEach(() => {
    db.close();
  });

  describe('trade_log', () => {
    it('inserts and retrieves a trade', () => {
      const trade: TradeLog = {
        id: 'trade-1',
        agent: 'arb-scanner',
        pair: 'SOL/USDT',
        side: 'buy',
        entry_price: 150.5,
        exit_price: null,
        quantity: 10,
        pnl: null,
        fee: 0.45,
        chain: 'solana',
        tx_hash: null,
        simulated: true,
        timestamp: new Date().toISOString(),
      };

      db.insertTrade(trade);
      const trades = db.getTradesByAgent('arb-scanner');

      expect(trades).toHaveLength(1);
      expect(trades[0].pair).toBe('SOL/USDT');
      expect(trades[0].side).toBe('buy');
    });
  });

  describe('signal_log', () => {
    it('inserts and retrieves a signal', () => {
      const signal: Signal = {
        id: 'sig-1',
        source_agent: 'whale-tracker',
        signal_type: 'whale_move',
        data: { wallet: 'abc123', amount: 50000 },
        confidence: 0.9,
        timestamp: new Date().toISOString(),
      };

      db.insertSignal(signal);
      const signals = db.getSignalsByType('whale_move');

      expect(signals).toHaveLength(1);
      expect(signals[0].source_agent).toBe('whale-tracker');
    });
  });

  describe('agent_state', () => {
    it('upserts agent state', () => {
      const agent: AgentState = {
        id: 'agent-1',
        agent_name: 'arb-scanner',
        status: 'running',
        config: { min_profit_usd: 5 },
        last_heartbeat: new Date().toISOString(),
        total_pnl: 0,
        trade_count: 0,
      };

      db.upsertAgentState(agent);
      const state = db.getAgentState('arb-scanner');

      expect(state).toBeDefined();
      expect(state!.status).toBe('running');
      expect(state!.agent_name).toBe('arb-scanner');
    });

    it('updates existing agent state', () => {
      const agent: AgentState = {
        id: 'agent-1',
        agent_name: 'arb-scanner',
        status: 'running',
        config: {},
        last_heartbeat: new Date().toISOString(),
        total_pnl: 100,
        trade_count: 5,
      };

      db.upsertAgentState(agent);
      agent.status = 'stopped';
      agent.total_pnl = 200;
      db.upsertAgentState(agent);

      const state = db.getAgentState('arb-scanner');
      expect(state!.status).toBe('stopped');
      expect(state!.total_pnl).toBe(200);
    });
  });

  describe('pnl calculation', () => {
    it('calculates total PnL for an agent', () => {
      db.insertTrade({
        id: 't1', agent: 'arb-scanner', pair: 'SOL/USDT', side: 'buy',
        entry_price: 100, exit_price: 110, quantity: 1, pnl: 10, fee: 0.3,
        chain: 'solana', tx_hash: null, simulated: true,
        timestamp: new Date().toISOString(),
      });
      db.insertTrade({
        id: 't2', agent: 'arb-scanner', pair: 'ETH/USDT', side: 'sell',
        entry_price: 200, exit_price: 195, quantity: 1, pnl: -5, fee: 0.3,
        chain: 'solana', tx_hash: null, simulated: true,
        timestamp: new Date().toISOString(),
      });

      const pnl = db.getAgentPnl('arb-scanner');
      expect(pnl).toBe(5);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run packages/core/__tests__/db.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement db.ts**

```typescript
import BetterSqlite3 from 'better-sqlite3';
import type { TradeLog, Signal, AgentState, RiskState, RiskMetric } from './types.js';
import { logger } from './logger.js';

export class Database {
  private db: BetterSqlite3.Database;

  constructor(dbPath: string) {
    this.db = new BetterSqlite3(dbPath);
    this.db.pragma('journal_mode = WAL');
  }

  initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS trade_log (
        id TEXT PRIMARY KEY,
        agent TEXT NOT NULL,
        pair TEXT NOT NULL,
        side TEXT NOT NULL,
        entry_price REAL,
        exit_price REAL,
        quantity REAL,
        pnl REAL,
        fee REAL,
        chain TEXT,
        tx_hash TEXT,
        simulated BOOLEAN DEFAULT 1,
        timestamp TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS signal_log (
        id TEXT PRIMARY KEY,
        source_agent TEXT NOT NULL,
        signal_type TEXT NOT NULL,
        data_json TEXT NOT NULL,
        confidence REAL,
        consumed_by TEXT,
        timestamp TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS agent_state (
        id TEXT PRIMARY KEY,
        agent_name TEXT UNIQUE NOT NULL,
        status TEXT NOT NULL,
        config_json TEXT,
        last_heartbeat TEXT,
        total_pnl REAL DEFAULT 0,
        trade_count INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS risk_state (
        id TEXT PRIMARY KEY,
        metric TEXT NOT NULL,
        value REAL NOT NULL,
        threshold REAL NOT NULL,
        breached BOOLEAN DEFAULT 0,
        timestamp TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS wallet_state (
        id TEXT PRIMARY KEY,
        chain TEXT NOT NULL,
        address TEXT NOT NULL,
        balance_json TEXT NOT NULL,
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);

    logger.info('Database initialized', { tables: 5 });
  }

  // --- Trade operations ---
  insertTrade(trade: TradeLog): void {
    this.db.prepare(`
      INSERT INTO trade_log (id, agent, pair, side, entry_price, exit_price, quantity, pnl, fee, chain, tx_hash, simulated, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      trade.id, trade.agent, trade.pair, trade.side,
      trade.entry_price, trade.exit_price, trade.quantity,
      trade.pnl, trade.fee, trade.chain, trade.tx_hash,
      trade.simulated ? 1 : 0, trade.timestamp
    );
  }

  getTradesByAgent(agent: string): TradeLog[] {
    return this.db.prepare('SELECT * FROM trade_log WHERE agent = ? ORDER BY timestamp DESC').all(agent) as TradeLog[];
  }

  getAgentPnl(agent: string): number {
    const row = this.db.prepare(
      "SELECT COALESCE(SUM(pnl), 0) as total FROM trade_log WHERE agent = ? AND pnl IS NOT NULL"
    ).get(agent) as { total: number };
    return row.total;
  }

  // --- Signal operations ---
  insertSignal(signal: Signal): void {
    this.db.prepare(`
      INSERT INTO signal_log (id, source_agent, signal_type, data_json, confidence, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      signal.id, signal.source_agent, signal.signal_type,
      JSON.stringify(signal.data), signal.confidence, signal.timestamp
    );
  }

  getSignalsByType(type: string): Signal[] {
    const rows = this.db.prepare(
      'SELECT * FROM signal_log WHERE signal_type = ? ORDER BY timestamp DESC'
    ).all(type) as (Signal & { data_json: string })[];

    return rows.map(({ data_json, ...rest }) => ({
      ...rest,
      data: JSON.parse(data_json),
    }));
  }

  // --- Agent state operations ---
  upsertAgentState(agent: AgentState): void {
    this.db.prepare(`
      INSERT INTO agent_state (id, agent_name, status, config_json, last_heartbeat, total_pnl, trade_count)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(agent_name) DO UPDATE SET
        status = excluded.status,
        config_json = excluded.config_json,
        last_heartbeat = excluded.last_heartbeat,
        total_pnl = excluded.total_pnl,
        trade_count = excluded.trade_count
    `).run(
      agent.id, agent.agent_name, agent.status,
      JSON.stringify(agent.config), agent.last_heartbeat,
      agent.total_pnl, agent.trade_count
    );
  }

  getAgentState(name: string): AgentState | undefined {
    const row = this.db.prepare('SELECT * FROM agent_state WHERE agent_name = ?').get(name) as (AgentState & { config_json: string }) | undefined;
    if (!row) return undefined;
    const { config_json, ...rest } = row;
    return { ...rest, config: JSON.parse(config_json) };
  }

  // --- Risk state operations ---
  upsertRiskState(state: RiskState): void {
    this.db.prepare(`
      INSERT INTO risk_state (id, metric, value, threshold, breached, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        value = excluded.value,
        threshold = excluded.threshold,
        breached = excluded.breached,
        timestamp = excluded.timestamp
    `).run(
      `risk-${state.metric}`, state.metric, state.value,
      state.threshold, state.breached ? 1 : 0, state.timestamp
    );
  }

  getRiskStates(): RiskState[] {
    return this.db.prepare('SELECT metric, value, threshold, breached, timestamp FROM risk_state').all() as RiskState[];
  }

  // --- Lifecycle ---
  close(): void {
    this.db.close();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run packages/core/__tests__/db.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(core): add SQLite database with trade, signal, agent, risk tables"
```

---

### Task 6: Core Package — Signal Bus

**Files:**
- Create: `packages/core/src/signal-bus.ts`
- Create: `packages/core/__tests__/signal-bus.test.ts`

- [ ] **Step 1: Write failing test for SignalBus**

```typescript
// packages/core/__tests__/signal-bus.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SignalBus } from '../src/signal-bus.js';
import type { Signal } from '../src/types.js';

describe('SignalBus', () => {
  let bus: SignalBus;

  beforeEach(() => {
    bus = new SignalBus('redis://localhost:6379');
  });

  afterEach(async () => {
    await bus.disconnect();
  });

  it('publishes and receives signals', async () => {
    const signal: Signal = {
      id: 'sig-test-1',
      source_agent: 'whale-tracker',
      signal_type: 'whale_move',
      data: { wallet: 'test', amount: 10000 },
      confidence: 0.85,
      timestamp: new Date().toISOString(),
    };

    const received: Signal[] = [];
    await bus.subscribe('whale_move', (s) => received.push(s));

    // Small delay to ensure subscription is active
    await new Promise((r) => setTimeout(r, 100));

    await bus.publish(signal);

    // Wait for message delivery
    await new Promise((r) => setTimeout(r, 200));

    expect(received).toHaveLength(1);
    expect(received[0].source_agent).toBe('whale-tracker');
    expect(received[0].data.wallet).toBe('test');
  });

  it('allows unsubscribing', async () => {
    const handler = await bus.subscribe('test_type', () => {});
    await bus.unsubscribe('test_type', handler);

    // Should not throw
  });
});
```

> **Note:** This test requires a running Redis instance. In CI, use Docker Compose or skip if Redis is unavailable.

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run packages/core/__tests__/signal-bus.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement signal-bus.ts**

```typescript
import Redis from 'ioredis';
import type { Signal, SignalType } from './types.js';
import { logger } from './logger.js';

export type SignalHandler = (signal: Signal) => void;

export class SignalBus {
  private publisher: Redis;
  private subscribers: Map<string, Redis> = new Map();
  private handlers: Map<string, Set<SignalHandler>> = new Map();

  constructor(redisUrl: string) {
    this.publisher = new Redis(redisUrl);
    logger.info('SignalBus initialized', { redisUrl });
  }

  async publish(signal: Signal): Promise<void> {
    const channel = `signal:${signal.signal_type}`;
    const payload = JSON.stringify(signal);
    await this.publisher.publish(channel, payload);
    logger.debug('Signal published', { channel, signal_id: signal.id });
  }

  async subscribe(signalType: SignalType, handler: SignalHandler): Promise<SignalHandler> {
    if (!this.handlers.has(signalType)) {
      this.handlers.set(signalType, new Set());
    }
    this.handlers.get(signalType)!.add(handler);

    if (!this.subscribers.has(signalType)) {
      const sub = new Redis(this.publisher.options.host ?? 'localhost', this.publisher.options.port ?? 6379);
      this.subscribers.set(signalType, sub);

      const channel = `signal:${signalType}`;
      await sub.subscribe(channel);

      sub.on('message', (ch: string, message: string) => {
        if (ch !== channel) return;
        try {
          const signal: Signal = JSON.parse(message);
          const handlers = this.handlers.get(signalType);
          if (handlers) {
            for (const h of handlers) {
              h(signal);
            }
          }
        } catch (err) {
          logger.error('Failed to parse signal', { error: String(err) });
        }
      });
    }

    return handler;
  }

  async unsubscribe(signalType: SignalType, handler: SignalHandler): Promise<void> {
    const handlers = this.handlers.get(signalType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        const sub = this.subscribers.get(signalType);
        if (sub) {
          await sub.unsubscribe(`signal:${signalType}`);
          sub.disconnect();
          this.subscribers.delete(signalType);
        }
        this.handlers.delete(signalType);
      }
    }
  }

  async disconnect(): Promise<void> {
    for (const [type, sub] of this.subscribers) {
      sub.disconnect();
    }
    this.subscribers.clear();
    this.handlers.clear();
    this.publisher.disconnect();
    logger.info('SignalBus disconnected');
  }
}
```

- [ ] **Step 4: Run test (requires Redis)**

```bash
docker compose up -d redis
npx vitest run packages/core/__tests__/signal-bus.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(core): add Redis-based signal bus for agent communication"
```

---

### Task 7: Docker Compose

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: Write docker-compose.yml**

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes

volumes:
  redis-data:
```

- [ ] **Step 2: Verify Redis starts**

```bash
docker compose up -d redis
docker compose ps
```

Expected: redis service showing "running".

```bash
docker compose down
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add Docker Compose with Redis for signal bus"
```

---

### Task 8: First MCP Server — risk-manager (Template)

This task creates the first MCP server which also serves as the template pattern for all other servers.

**Files:**
- Create: `packages/mcp-servers/risk-manager/package.json`
- Create: `packages/mcp-servers/risk-manager/tsconfig.json`
- Create: `packages/mcp-servers/risk-manager/src/index.ts`
- Create: `packages/mcp-servers/risk-manager/src/tools.ts`
- Create: `packages/mcp-servers/risk-manager/__tests__/tools.test.ts`

- [ ] **Step 1: Create risk-manager package.json**

```json
{
  "name": "@trade/mcp-risk-manager",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "trade-risk-manager": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "@trade/core": "*",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create risk-manager tsconfig.json**

```json
{
  "extends": "../../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "__tests__"]
}
```

- [ ] **Step 3: Write failing test for risk-manager tools**

```typescript
// packages/mcp-servers/risk-manager/__tests__/tools.test.ts
import { describe, it, expect } from 'vitest';
import { RiskManager } from '../src/tools.js';

describe('RiskManager', () => {
  const config = {
    max_total_exposure_usd: 5000,
    max_single_trade_usd: 500,
    max_drawdown_pct: 10,
    circuit_breaker_loss_usd: 200,
    daily_loss_limit_usd: 300,
  };

  it('allows trade within limits', () => {
    const rm = new RiskManager(config);
    const result = rm.checkTrade({ agent: 'arb-scanner', amount_usd: 200, current_exposure: 1000 });
    expect(result.approved).toBe(true);
  });

  it('rejects trade exceeding single trade limit', () => {
    const rm = new RiskManager(config);
    const result = rm.checkTrade({ agent: 'arb-scanner', amount_usd: 600, current_exposure: 1000 });
    expect(result.approved).toBe(false);
    expect(result.reason).toContain('single trade');
  });

  it('rejects trade exceeding total exposure', () => {
    const rm = new RiskManager(config);
    const result = rm.checkTrade({ agent: 'arb-scanner', amount_usd: 200, current_exposure: 4900 });
    expect(result.approved).toBe(false);
    expect(result.reason).toContain('total exposure');
  });

  it('triggers circuit breaker on daily loss', () => {
    const rm = new RiskManager(config);
    rm.recordTrade({ pnl: -150 });
    rm.recordTrade({ pnl: -100 });
    const result = rm.checkTrade({ agent: 'arb-scanner', amount_usd: 100, current_exposure: 1000 });
    expect(result.approved).toBe(false);
    expect(result.circuit_breaker).toBe(true);
  });

  it('calculates current drawdown from peak', () => {
    const rm = new RiskManager(config);
    rm.setPeakBalance(10000);
    rm.setCurrentBalance(9200);
    const dd = rm.getDrawdownPct();
    expect(dd).toBe(8);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

```bash
npx vitest run packages/mcp-servers/risk-manager/__tests__/tools.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 5: Implement tools.ts**

```typescript
import type { RiskConfig } from '@trade/core';

interface TradeCheckRequest {
  agent: string;
  amount_usd: number;
  current_exposure: number;
}

interface TradeRecord {
  pnl: number;
}

interface TradeCheckResult {
  approved: boolean;
  reason?: string;
  circuit_breaker?: boolean;
}

export class RiskManager {
  private config: RiskConfig;
  private dailyPnl: number = 0;
  private peakBalance: number = 0;
  private currentBalance: number = 0;
  private circuitBreakerActive: boolean = false;

  constructor(config: RiskConfig) {
    this.config = config;
  }

  checkTrade(req: TradeCheckRequest): TradeCheckResult {
    // Circuit breaker check
    if (this.circuitBreakerActive) {
      return { approved: false, reason: 'Circuit breaker is active', circuit_breaker: true };
    }

    // Single trade limit
    if (req.amount_usd > this.config.max_single_trade_usd) {
      return { approved: false, reason: `Trade $${req.amount_usd} exceeds single trade limit $${this.config.max_single_trade_usd}` };
    }

    // Total exposure limit
    if (req.current_exposure + req.amount_usd > this.config.max_total_exposure_usd) {
      return { approved: false, reason: `Total exposure $${req.current_exposure + req.amount_usd} would exceed limit $${this.config.max_total_exposure_usd}` };
    }

    return { approved: true };
  }

  recordTrade(trade: TradeRecord): void {
    this.dailyPnl += trade.pnl;

    // Check daily loss limit
    if (this.dailyPnl <= -this.config.daily_loss_limit_usd) {
      this.circuitBreakerActive = true;
    }

    // Check circuit breaker loss
    if (this.dailyPnl <= -this.config.circuit_breaker_loss_usd) {
      this.circuitBreakerActive = true;
    }
  }

  setPeakBalance(amount: number): void {
    this.peakBalance = amount;
  }

  setCurrentBalance(amount: number): void {
    this.currentBalance = amount;
  }

  getDrawdownPct(): number {
    if (this.peakBalance === 0) return 0;
    return ((this.peakBalance - this.currentBalance) / this.peakBalance) * 100;
  }

  isDrawdownBreached(): boolean {
    return this.getDrawdownPct() > this.config.max_drawdown_pct;
  }

  isCircuitBreakerActive(): boolean {
    return this.circuitBreakerActive;
  }

  getDailyPnl(): number {
    return this.dailyPnl;
  }

  resetDaily(): void {
    this.dailyPnl = 0;
    this.circuitBreakerActive = false;
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
npx vitest run packages/mcp-servers/risk-manager/__tests__/tools.test.ts
```

Expected: PASS.

- [ ] **Step 7: Implement MCP server entry point (index.ts)**

```typescript
#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { RiskManager } from './tools.js';
import type { RiskConfig } from '@trade/core';

const config: RiskConfig = {
  max_total_exposure_usd: Number(process.env.MAX_TOTAL_EXPOSURE_USD) || 5000,
  max_single_trade_usd: Number(process.env.MAX_SINGLE_TRADE_USD) || 500,
  max_drawdown_pct: Number(process.env.MAX_DRAWDOWN_PCT) || 10,
  circuit_breaker_loss_usd: Number(process.env.CIRCUIT_BREAKER_LOSS_USD) || 200,
  daily_loss_limit_usd: Number(process.env.DAILY_LOSS_LIMIT_USD) || 300,
};

const rm = new RiskManager(config);

const server = new McpServer({
  name: 'risk-manager',
  version: '0.1.0',
});

server.tool(
  'check_trade',
  'Check if a proposed trade passes risk limits',
  {
    agent: z.string().describe('Agent proposing the trade'),
    amount_usd: z.number().positive().describe('Trade amount in USD'),
    current_exposure: z.number().min(0).describe('Current total exposure in USD'),
  },
  async ({ agent, amount_usd, current_exposure }) => {
    const result = rm.checkTrade({ agent, amount_usd, current_exposure });
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

server.tool(
  'circuit_breaker_status',
  'Check if the circuit breaker is active',
  {},
  async () => {
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          active: rm.isCircuitBreakerActive(),
          daily_pnl: rm.getDailyPnl(),
          drawdown_pct: rm.getDrawdownPct(),
          drawdown_breached: rm.isDrawdownBreached(),
        }, null, 2),
      }],
    };
  }
);

server.tool(
  'record_trade_result',
  'Record a completed trade result for risk tracking',
  {
    pnl: z.number().describe('Profit/loss amount in USD'),
  },
  async ({ pnl }) => {
    rm.recordTrade({ pnl });
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          recorded: true,
          daily_pnl: rm.getDailyPnl(),
          circuit_breaker: rm.isCircuitBreakerActive(),
        }, null, 2),
      }],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
```

- [ ] **Step 8: Build and verify**

```bash
npm install
cd packages/mcp-servers/risk-manager && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(mcp): add risk-manager MCP server with trade checking and circuit breaker"
```

---

### Task 9: Final Verification

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 2: Build all packages**

```bash
npm run build
```

Expected: All packages build successfully.

- [ ] **Step 3: Verify Docker Compose**

```bash
docker compose up -d
docker compose ps
docker compose down
```

Expected: Redis starts and stops cleanly.

- [ ] **Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "chore: foundation verification and fixes"
```

---

## Self-Review

**Spec coverage:**
- Core types (types.ts) — covers TradeLog, Signal, AgentState, RiskState, Config ✓
- Config loader (config.ts) — loads default.yaml ✓
- Database (db.ts) — SQLite with all 5 tables from spec ✓
- Signal Bus (signal-bus.ts) — Redis Pub/Sub for agent communication ✓
- Risk Manager MCP server — first MCP server with trade checking ✓
- Docker Compose — Redis service ✓
- Logger — structured logging ✓

**Placeholder scan:** No TBD, TODO, or vague instructions found.

**Type consistency:** All types in types.ts match usage in db.ts, signal-bus.ts, and risk-manager tools.ts. Signal, TradeLog, AgentState, RiskConfig used consistently.
