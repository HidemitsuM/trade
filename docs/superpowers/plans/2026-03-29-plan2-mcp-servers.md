# Plan 2: MCP Servers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build 11 MCP servers (helius, dune, phantom, coinmarketcap, coingecko, browser, git-mcp, bnb-chain, jupiter, 1inch, polymarket) following the pattern established by risk-manager.

**Architecture:** Each MCP server is a standalone Node.js process using `StdioServerTransport`. Business logic lives in `tools.ts`, MCP registration in `index.ts`. All servers follow the same file structure: `src/index.ts`, `src/tools.ts`, `__tests__/tools.test.ts`.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk`, `zod`, `vitest`

---

## File Structure Per Server

Each server follows this pattern (matching `risk-manager`):

```
packages/mcp-servers/<name>/
├── src/
│   ├── index.ts          # MCP server setup + tool registration
│   └── tools.ts          # Business logic class
├── __tests__/
│   └── tools.test.ts     # Unit tests for business logic
├── package.json
└── tsconfig.json
```

`package.json` template:
```json
{
  "name": "@trade/mcp-<name>",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "bin": { "trade-<name>": "dist/index.js" },
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

`tsconfig.json` template (same as risk-manager):
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src"]
}
```

---

### Task 1: helius — Solana RPC & Transaction Monitoring

**Files:**
- Create: `packages/mcp-servers/helius/package.json`
- Create: `packages/mcp-servers/helius/tsconfig.json`
- Create: `packages/mcp-servers/helius/src/tools.ts`
- Create: `packages/mcp-servers/helius/src/index.ts`
- Create: `packages/mcp-servers/helius/__tests__/tools.test.ts`

- [ ] **Step 1: Create package.json and tsconfig.json**

`packages/mcp-servers/helius/package.json`:
```json
{
  "name": "@trade/mcp-helius",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "bin": { "trade-helius": "dist/index.js" },
  "scripts": { "build": "tsc", "dev": "tsc --watch", "start": "node dist/index.js" },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "@trade/core": "*",
    "zod": "^3.24.0"
  },
  "devDependencies": { "typescript": "^5.7.0" }
}
```

`packages/mcp-servers/helius/tsconfig.json`: (use template above)

- [ ] **Step 2: Write the failing test**

`packages/mcp-servers/helius/__tests__/tools.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { HeliusClient } from '../src/tools.js';

describe('HeliusClient', () => {
  let client: HeliusClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new HeliusClient('https://mainnet.helius-rpc.com?api-key=test-key');
  });

  describe('getTransaction', () => {
    it('fetches transaction details by signature', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          result: {
            signature: 'abc123',
            slot: 123456,
            meta: { err: null, fee: 5000 },
          },
        }),
      });

      const tx = await client.getTransaction('abc123');
      expect(tx.signature).toBe('abc123');
      expect(tx.slot).toBe(123456);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
      await expect(client.getTransaction('bad')).rejects.toThrow('Helius API error: 500');
    });
  });

  describe('getTokenInfo', () => {
    it('returns token metadata', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          result: {
            mint: 'TokenMintAddress',
            decimals: 9,
            symbol: 'SOL',
          },
        }),
      });

      const info = await client.getTokenInfo('TokenMintAddress');
      expect(info.symbol).toBe('SOL');
      expect(info.decimals).toBe(9);
    });
  });

  describe('getAccountBalance', () => {
    it('returns SOL balance in lamports', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          result: { value: 5000000000, lamports: 5000000000 },
        }),
      });

      const balance = await client.getAccountBalance('wallet123');
      expect(balance.lamports).toBe(5000000000);
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run packages/mcp-servers/helius/__tests__/tools.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Write minimal implementation**

`packages/mcp-servers/helius/src/tools.ts`:
```typescript
export interface TransactionInfo {
  signature: string;
  slot: number;
  meta: { err: unknown; fee: number } | null;
}

export interface TokenInfo {
  mint: string;
  decimals: number;
  symbol: string;
}

export interface BalanceInfo {
  lamports: number;
  value: number;
}

export class HeliusClient {
  private rpcUrl: string;

  constructor(rpcUrl: string) {
    this.rpcUrl = rpcUrl;
  }

  private async rpcCall(method: string, params: unknown[]): Promise<unknown> {
    const res = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    if (!res.ok) throw new Error(`Helius API error: ${res.status}`);
    const data = await res.json() as { result: unknown };
    return data.result;
  }

  async getTransaction(signature: string): Promise<TransactionInfo> {
    const result = await this.rpcCall('getTransaction', [
      signature,
      { encoding: 'json', commitment: 'confirmed' },
    ]) as TransactionInfo;
    return result;
  }

  async getTokenInfo(mint: string): Promise<TokenInfo> {
    const result = await this.rpcCall('getAsset', [mint]) as TokenInfo;
    return result;
  }

  async getAccountBalance(address: string): Promise<BalanceInfo> {
    const result = await this.rpcCall('getBalance', [address]) as BalanceInfo;
    return result;
  }
}
```

`packages/mcp-servers/helius/src/index.ts`:
```typescript
#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { HeliusClient } from './tools.js';

const rpcUrl = process.env.HELIUS_RPC_URL || 'https://mainnet.helius-rpc.com?api-key=';
const client = new HeliusClient(rpcUrl);

const server = new McpServer({ name: 'helius', version: '0.1.0' });

server.tool(
  'get_transaction',
  'Get Solana transaction details by signature',
  {
    signature: z.string().describe('Transaction signature'),
  },
  async ({ signature }) => {
    const tx = await client.getTransaction(signature);
    return { content: [{ type: 'text' as const, text: JSON.stringify(tx, null, 2) }] };
  }
);

server.tool(
  'get_token_info',
  'Get Solana token metadata by mint address',
  {
    mint: z.string().describe('Token mint address'),
  },
  async ({ mint }) => {
    const info = await client.getTokenInfo(mint);
    return { content: [{ type: 'text' as const, text: JSON.stringify(info, null, 2) }] };
  }
);

server.tool(
  'get_account_balance',
  'Get SOL balance for a wallet address',
  {
    address: z.string().describe('Wallet address'),
  },
  async ({ address }) => {
    const balance = await client.getAccountBalance(address);
    return { content: [{ type: 'text' as const, text: JSON.stringify(balance, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run packages/mcp-servers/helius/__tests__/tools.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/mcp-servers/helius/
git commit -m "feat(mcp): add helius MCP server with Solana RPC tools"
```

---

### Task 2: dune — On-chain Data Queries

**Files:**
- Create: `packages/mcp-servers/dune/package.json`
- Create: `packages/mcp-servers/dune/tsconfig.json`
- Create: `packages/mcp-servers/dune/src/tools.ts`
- Create: `packages/mcp-servers/dune/src/index.ts`
- Create: `packages/mcp-servers/dune/__tests__/tools.test.ts`

- [ ] **Step 1: Create package.json and tsconfig.json**

`packages/mcp-servers/dune/package.json`:
```json
{
  "name": "@trade/mcp-dune",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "bin": { "trade-dune": "dist/index.js" },
  "scripts": { "build": "tsc", "dev": "tsc --watch", "start": "node dist/index.js" },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "@trade/core": "*",
    "zod": "^3.24.0"
  },
  "devDependencies": { "typescript": "^5.7.0" }
}
```

tsconfig.json: (use template)

- [ ] **Step 2: Write the failing test**

`packages/mcp-servers/dune/__tests__/tools.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { DuneClient } from '../src/tools.js';

describe('DuneClient', () => {
  let client: DuneClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new DuneClient('test-api-key');
  });

  describe('executeQuery', () => {
    it('executes a Dune query by ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          result: {
            rows: [{ wallet: '0xabc', volume_usd: 15000 }],
            execution_id: 'exec-123',
          },
        }),
      });

      const result = await client.executeQuery(12345);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].volume_usd).toBe(15000);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.dune.com/api/v1/query/12345/execute',
        expect.objectContaining({ headers: expect.objectContaining({ 'X-DUNE-API-Key': 'test-api-key' }) })
      );
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
      await expect(client.executeQuery(1)).rejects.toThrow('Dune API error: 401');
    });
  });

  describe('getQueryResults', () => {
    it('retrieves cached query results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          result: {
            rows: [{ token: 'SOL', price: 150.5 }],
            result_set_rows: 1,
          },
        }),
      });

      const result = await client.getQueryResults(99999);
      expect(result.rows).toHaveLength(1);
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run packages/mcp-servers/dune/__tests__/tools.test.ts`
Expected: FAIL

- [ ] **Step 4: Write minimal implementation**

`packages/mcp-servers/dune/src/tools.ts`:
```typescript
const DUNE_BASE_URL = 'https://api.dune.com/api/v1';

export interface DuneRow {
  [key: string]: unknown;
}

export interface DuneResult {
  rows: DuneRow[];
  execution_id?: string;
  result_set_rows?: number;
}

export class DuneClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async executeQuery(queryId: number): Promise<DuneResult> {
    const res = await fetch(`${DUNE_BASE_URL}/query/${queryId}/execute`, {
      method: 'POST',
      headers: {
        'X-DUNE-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) throw new Error(`Dune API error: ${res.status}`);
    const data = await res.json() as { result: DuneResult };
    return data.result;
  }

  async getQueryResults(queryId: number): Promise<DuneResult> {
    const res = await fetch(`${DUNE_BASE_URL}/query/${queryId}/results`, {
      headers: { 'X-DUNE-API-Key': this.apiKey },
    });
    if (!res.ok) throw new Error(`Dune API error: ${res.status}`);
    const data = await res.json() as { result: DuneResult };
    return data.result;
  }
}
```

`packages/mcp-servers/dune/src/index.ts`:
```typescript
#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { DuneClient } from './tools.js';

const client = new DuneClient(process.env.DUNE_API_KEY || '');
const server = new McpServer({ name: 'dune', version: '0.1.0' });

server.tool(
  'execute_query',
  'Execute a Dune Analytics query by ID and return results',
  {
    query_id: z.number().describe('Dune query ID'),
  },
  async ({ query_id }) => {
    const result = await client.executeQuery(query_id);
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'get_query_results',
  'Get cached results of a previously executed Dune query',
  {
    query_id: z.number().describe('Dune query ID'),
  },
  async ({ query_id }) => {
    const result = await client.getQueryResults(query_id);
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run packages/mcp-servers/dune/__tests__/tools.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/mcp-servers/dune/
git commit -m "feat(mcp): add dune MCP server for on-chain data queries"
```

---

### Task 3: phantom — Solana Wallet Operations

**Files:**
- Create: `packages/mcp-servers/phantom/package.json`
- Create: `packages/mcp-servers/phantom/tsconfig.json`
- Create: `packages/mcp-servers/phantom/src/tools.ts`
- Create: `packages/mcp-servers/phantom/src/index.ts`
- Create: `packages/mcp-servers/phantom/__tests__/tools.test.ts`

- [ ] **Step 1: Create package.json and tsconfig.json**

`packages/mcp-servers/phantom/package.json`:
```json
{
  "name": "@trade/mcp-phantom",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "bin": { "trade-phantom": "dist/index.js" },
  "scripts": { "build": "tsc", "dev": "tsc --watch", "start": "node dist/index.js" },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "@trade/core": "*",
    "zod": "^3.24.0"
  },
  "devDependencies": { "typescript": "^5.7.0" }
}
```

tsconfig.json: (use template)

- [ ] **Step 2: Write the failing test**

`packages/mcp-servers/phantom/__tests__/tools.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { PhantomClient } from '../src/tools.js';

describe('PhantomClient', () => {
  let client: PhantomClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new PhantomClient('https://mainnet.helius-rpc.com?api-key=test', 'test-private-key');
  });

  describe('getBalance', () => {
    it('returns SOL balance for a wallet', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ result: { value: 5000000000 } }),
      });

      const balance = await client.getBalance('wallet123');
      expect(balance).toBe(5000000000);
    });
  });

  describe('sendTransaction', () => {
    it('sends a signed transaction and returns signature', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ result: 'txSignature123' }),
      });

      const sig = await client.sendTransaction('serialized-txn-data');
      expect(sig).toBe('txSignature123');
    });

    it('throws on failed transaction', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ result: null }) });
      await expect(client.sendTransaction('bad-txn')).rejects.toThrow('Transaction failed');
    });
  });

  describe('getTokenAccounts', () => {
    it('returns token accounts for a wallet', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          result: { value: [
            { account: { data: 'parsed', info: { mint: 'TokenMint1', amount: '1000' } } },
            { account: { data: 'parsed', info: { mint: 'TokenMint2', amount: '500' } } },
          ]},
        }),
      });

      const accounts = await client.getTokenAccounts('wallet123');
      expect(accounts).toHaveLength(2);
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run packages/mcp-servers/phantom/__tests__/tools.test.ts`
Expected: FAIL

- [ ] **Step 4: Write minimal implementation**

`packages/mcp-servers/phantom/src/tools.ts`:
```typescript
export interface TokenAccount {
  mint: string;
  amount: string;
}

export class PhantomClient {
  private rpcUrl: string;
  private privateKey: string;

  constructor(rpcUrl: string, privateKey: string) {
    this.rpcUrl = rpcUrl;
    this.privateKey = privateKey;
  }

  private async rpcCall(method: string, params: unknown[]): Promise<unknown> {
    const res = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    if (!res.ok) throw new Error(`Phantom RPC error: ${res.status}`);
    return (await res.json() as { result: unknown }).result;
  }

  async getBalance(address: string): Promise<number> {
    const result = await this.rpcCall('getBalance', [address]) as { value: number };
    return result.value;
  }

  async sendTransaction(serializedTx: string): Promise<string> {
    const result = await this.rpcCall('sendTransaction', [
      serializedTx,
      { encoding: 'base64' },
    ]) as string | null;
    if (!result) throw new Error('Transaction failed');
    return result;
  }

  async getTokenAccounts(address: string): Promise<TokenAccount[]> {
    const result = await this.rpcCall('getTokenAccountsByOwner', [
      address,
      { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
      { encoding: 'jsonParsed' },
    ]) as { value: Array<{ account: { info: { mint: string; amount: string } } }> };
    return (result.value ?? []).map((v) => ({
      mint: v.account.info.mint,
      amount: v.account.info.amount,
    }));
  }
}
```

`packages/mcp-servers/phantom/src/index.ts`:
```typescript
#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { PhantomClient } from './tools.js';

const rpcUrl = process.env.HELIUS_RPC_URL || '';
const privateKey = process.env.PHANTOM_PRIVATE_KEY || '';
const client = new PhantomClient(rpcUrl, privateKey);
const server = new McpServer({ name: 'phantom', version: '0.1.0' });

server.tool(
  'get_balance',
  'Get SOL balance for a wallet address',
  { address: z.string().describe('Wallet address') },
  async ({ address }) => {
    const balance = await client.getBalance(address);
    return { content: [{ type: 'text' as const, text: JSON.stringify({ lamports: balance, sol: balance / 1e9 }, null, 2) }] };
  }
);

server.tool(
  'send_transaction',
  'Send a signed Solana transaction',
  { serialized_tx: z.string().describe('Base64-encoded serialized transaction') },
  async ({ serialized_tx }) => {
    const signature = await client.sendTransaction(serialized_tx);
    return { content: [{ type: 'text' as const, text: JSON.stringify({ signature }, null, 2) }] };
  }
);

server.tool(
  'get_token_accounts',
  'Get SPL token accounts for a wallet',
  { address: z.string().describe('Wallet address') },
  async ({ address }) => {
    const accounts = await client.getTokenAccounts(address);
    return { content: [{ type: 'text' as const, text: JSON.stringify(accounts, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run packages/mcp-servers/phantom/__tests__/tools.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/mcp-servers/phantom/
git commit -m "feat(mcp): add phantom MCP server for Solana wallet operations"
```

---

### Task 4: coinmarketcap — Price, Market Cap, Fear & Greed

**Files:**
- Create: `packages/mcp-servers/coinmarketcap/package.json`
- Create: `packages/mcp-servers/coinmarketcap/tsconfig.json`
- Create: `packages/mcp-servers/coinmarketcap/src/tools.ts`
- Create: `packages/mcp-servers/coinmarketcap/src/index.ts`
- Create: `packages/mcp-servers/coinmarketcap/__tests__/tools.test.ts`

- [ ] **Step 1: Create package.json and tsconfig.json**

`packages/mcp-servers/coinmarketcap/package.json`:
```json
{
  "name": "@trade/mcp-coinmarketcap",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "bin": { "trade-coinmarketcap": "dist/index.js" },
  "scripts": { "build": "tsc", "dev": "tsc --watch", "start": "node dist/index.js" },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "@trade/core": "*",
    "zod": "^3.24.0"
  },
  "devDependencies": { "typescript": "^5.7.0" }
}
```

tsconfig.json: (use template)

- [ ] **Step 2: Write the failing test**

`packages/mcp-servers/coinmarketcap/__tests__/tools.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { CoinMarketCapClient } from '../src/tools.js';

describe('CoinMarketCapClient', () => {
  let client: CoinMarketCapClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new CoinMarketCapClient('test-api-key');
  });

  describe('getLatestQuotes', () => {
    it('returns price quotes for specified symbols', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: {
            SOL: { quote: { USD: { price: 150.5, market_cap: 65000000000 } } },
            ETH: { quote: { USD: { price: 3200.0, market_cap: 385000000000 } } },
          },
        }),
      });

      const quotes = await client.getLatestQuotes(['SOL', 'ETH']);
      expect(quotes.SOL.price).toBe(150.5);
      expect(quotes.ETH.market_cap).toBe(385000000000);
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
      await expect(client.getLatestQuotes(['BTC'])).rejects.toThrow('CoinMarketCap API error: 401');
    });
  });

  describe('getFearGreed', () => {
    it('returns current Fear & Greed index', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: { value: 72, value_classification: 'Greed' },
        }),
      });

      const fg = await client.getFearGreed();
      expect(fg.value).toBe(72);
      expect(fg.classification).toBe('Greed');
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run packages/mcp-servers/coinmarketcap/__tests__/tools.test.ts`
Expected: FAIL

- [ ] **Step 4: Write minimal implementation**

`packages/mcp-servers/coinmarketcap/src/tools.ts`:
```typescript
const CMC_BASE_URL = 'https://pro-api.coinmarketcap.com';

export interface Quote {
  price: number;
  market_cap: number;
  volume_24h: number;
  percent_change_24h: number;
}

export interface FearGreed {
  value: number;
  classification: string;
}

export class CoinMarketCapClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getLatestQuotes(symbols: string[]): Promise<Record<string, Quote>> {
    const res = await fetch(`${CMC_BASE_URL}/v2/cryptocurrency/quotes/latest?symbol=${symbols.join(',')}`, {
      headers: { 'X-CMC_PRO_API_KEY': this.apiKey },
    });
    if (!res.ok) throw new Error(`CoinMarketCap API error: ${res.status}`);
    const data = await res.json() as {
      data: Record<string, { quote: { USD: { price: number; market_cap: number; volume_24h: number; percent_change_24h: number } } }>;
    };

    const result: Record<string, Quote> = {};
    for (const [symbol, info] of Object.entries(data.data)) {
      result[symbol] = info.quote.USD;
    }
    return result;
  }

  async getFearGreed(): Promise<FearGreed> {
    const res = await fetch(`${CMC_BASE_URL}/v3/fear-and-greed`, {
      headers: { 'X-CMC_PRO_API_KEY': this.apiKey },
    });
    if (!res.ok) throw new Error(`CoinMarketCap API error: ${res.status}`);
    const data = await res.json() as { data: { value: number; value_classification: string } };
    return { value: data.data.value, classification: data.data.value_classification };
  }
}
```

`packages/mcp-servers/coinmarketcap/src/index.ts`:
```typescript
#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { CoinMarketCapClient } from './tools.js';

const client = new CoinMarketCapClient(process.env.CMC_API_KEY || '');
const server = new McpServer({ name: 'coinmarketcap', version: '0.1.0' });

server.tool(
  'get_price',
  'Get latest cryptocurrency prices from CoinMarketCap',
  {
    symbols: z.array(z.string()).describe('Array of ticker symbols, e.g. ["SOL", "ETH", "BTC"]'),
  },
  async ({ symbols }) => {
    const quotes = await client.getLatestQuotes(symbols);
    return { content: [{ type: 'text' as const, text: JSON.stringify(quotes, null, 2) }] };
  }
);

server.tool(
  'get_fear_greed',
  'Get the current Crypto Fear & Greed Index',
  {},
  async () => {
    const fg = await client.getFearGreed();
    return { content: [{ type: 'text' as const, text: JSON.stringify(fg, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run packages/mcp-servers/coinmarketcap/__tests__/tools.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/mcp-servers/coinmarketcap/
git commit -m "feat(mcp): add coinmarketcap MCP server for price and Fear&Greed data"
```

---

### Task 5: coingecko — Price, Liquidity, Trending

**Files:**
- Create: `packages/mcp-servers/coingecko/package.json`
- Create: `packages/mcp-servers/coingecko/tsconfig.json`
- Create: `packages/mcp-servers/coingecko/src/tools.ts`
- Create: `packages/mcp-servers/coingecko/src/index.ts`
- Create: `packages/mcp-servers/coingecko/__tests__/tools.test.ts`

- [ ] **Step 1: Create package.json and tsconfig.json**

`packages/mcp-servers/coingecko/package.json`:
```json
{
  "name": "@trade/mcp-coingecko",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "bin": { "trade-coingecko": "dist/index.js" },
  "scripts": { "build": "tsc", "dev": "tsc --watch", "start": "node dist/index.js" },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "@trade/core": "*",
    "zod": "^3.24.0"
  },
  "devDependencies": { "typescript": "^5.7.0" }
}
```

tsconfig.json: (use template)

- [ ] **Step 2: Write the failing test**

`packages/mcp-servers/coingecko/__tests__/tools.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { CoinGeckoClient } from '../src/tools.js';

describe('CoinGeckoClient', () => {
  let client: CoinGeckoClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new CoinGeckoClient('test-api-key');
  });

  describe('getPrice', () => {
    it('returns current price for a coin', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ solana: { usd: 150.5 } }),
      });

      const price = await client.getPrice('solana');
      expect(price).toBe(150.5);
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 429 });
      await expect(client.getPrice('bitcoin')).rejects.toThrow('CoinGecko API error: 429');
    });
  });

  describe('getTrending', () => {
    it('returns trending coins', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          coins: [
            { item: { id: 'pepe', name: 'Pepe', symbol: 'PEPE', market_cap_rank: 23 } },
            { item: { id: 'bonk', name: 'Bonk', symbol: 'BONK', market_cap_rank: 45 } },
          ],
        }),
      });

      const trending = await client.getTrending();
      expect(trending).toHaveLength(2);
      expect(trending[0].symbol).toBe('PEPE');
    });
  });

  describe('getTokenInfo', () => {
    it('returns detailed token information', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          market_cap_rank: 5,
          market_data: {
            current_price: { usd: 150.5 },
            total_volume: { usd: 2500000000 },
            price_change_percentage_24h: 3.2,
          },
        }),
      });

      const info = await client.getTokenInfo('solana');
      expect(info.price).toBe(150.5);
      expect(info.volume_24h).toBe(2500000000);
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run packages/mcp-servers/coingecko/__tests__/tools.test.ts`
Expected: FAIL

- [ ] **Step 4: Write minimal implementation**

`packages/mcp-servers/coingecko/src/tools.ts`:
```typescript
const GECKO_BASE_URL = 'https://api.coingecko.com/api/v3';

export interface TrendingCoin {
  id: string;
  name: string;
  symbol: string;
  market_cap_rank: number;
}

export interface TokenDetail {
  price: number;
  volume_24h: number;
  price_change_pct_24h: number;
  market_cap_rank: number;
}

export class CoinGeckoClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {};
    if (this.apiKey) h['x-cg-demo-api-key'] = this.apiKey;
    return h;
  }

  async getPrice(coinId: string, vsCurrency = 'usd'): Promise<number> {
    const res = await fetch(
      `${GECKO_BASE_URL}/simple/price?ids=${coinId}&vs_currencies=${vsCurrency}`,
      { headers: this.headers() }
    );
    if (!res.ok) throw new Error(`CoinGecko API error: ${res.status}`);
    const data = await res.json() as Record<string, Record<string, number>>;
    return data[coinId][vsCurrency];
  }

  async getTrending(): Promise<TrendingCoin[]> {
    const res = await fetch(`${GECKO_BASE_URL}/search/trending`, { headers: this.headers() });
    if (!res.ok) throw new Error(`CoinGecko API error: ${res.status}`);
    const data = await res.json() as {
      coins: Array<{ item: { id: string; name: string; symbol: string; market_cap_rank: number } }>;
    };
    return data.coins.map((c) => ({
      id: c.item.id,
      name: c.item.name,
      symbol: c.item.symbol,
      market_cap_rank: c.item.market_cap_rank,
    }));
  }

  async getTokenInfo(coinId: string): Promise<TokenDetail> {
    const res = await fetch(`${GECKO_BASE_URL}/coins/${coinId}?localization=false&tickers=false`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`CoinGecko API error: ${res.status}`);
    const data = await res.json() as {
      market_cap_rank: number;
      market_data: {
        current_price: { usd: number };
        total_volume: { usd: number };
        price_change_percentage_24h: number;
      };
    };
    return {
      price: data.market_data.current_price.usd,
      volume_24h: data.market_data.total_volume.usd,
      price_change_pct_24h: data.market_data.price_change_percentage_24h,
      market_cap_rank: data.market_cap_rank,
    };
  }
}
```

`packages/mcp-servers/coingecko/src/index.ts`:
```typescript
#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { CoinGeckoClient } from './tools.js';

const client = new CoinGeckoClient(process.env.COINGECKO_API_KEY || '');
const server = new McpServer({ name: 'coingecko', version: '0.1.0' });

server.tool(
  'get_price',
  'Get current price for a cryptocurrency',
  {
    coin_id: z.string().describe('CoinGecko coin ID, e.g. "solana", "ethereum"'),
    vs_currency: z.string().optional().describe('Currency, default "usd"'),
  },
  async ({ coin_id, vs_currency }) => {
    const price = await client.getPrice(coin_id, vs_currency);
    return { content: [{ type: 'text' as const, text: JSON.stringify({ coin_id, price }, null, 2) }] };
  }
);

server.tool(
  'get_trending',
  'Get currently trending cryptocurrencies',
  {},
  async () => {
    const trending = await client.getTrending();
    return { content: [{ type: 'text' as const, text: JSON.stringify(trending, null, 2) }] };
  }
);

server.tool(
  'get_token_info',
  'Get detailed information for a cryptocurrency',
  { coin_id: z.string().describe('CoinGecko coin ID') },
  async ({ coin_id }) => {
    const info = await client.getTokenInfo(coin_id);
    return { content: [{ type: 'text' as const, text: JSON.stringify(info, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run packages/mcp-servers/coingecko/__tests__/tools.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/mcp-servers/coingecko/
git commit -m "feat(mcp): add coingecko MCP server for price and trending data"
```

---

### Task 6: browser — Web Scraping via Playwright

**Files:**
- Create: `packages/mcp-servers/browser/package.json`
- Create: `packages/mcp-servers/browser/tsconfig.json`
- Create: `packages/mcp-servers/browser/src/tools.ts`
- Create: `packages/mcp-servers/browser/src/index.ts`
- Create: `packages/mcp-servers/browser/__tests__/tools.test.ts`

- [ ] **Step 1: Create package.json and tsconfig.json**

`packages/mcp-servers/browser/package.json`:
```json
{
  "name": "@trade/mcp-browser",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "bin": { "trade-browser": "dist/index.js" },
  "scripts": { "build": "tsc", "dev": "tsc --watch", "start": "node dist/index.js" },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "@trade/core": "*",
    "zod": "^3.24.0",
    "playwright": "^1.50.0"
  },
  "devDependencies": { "typescript": "^5.7.0" }
}
```

tsconfig.json: (use template)

- [ ] **Step 2: Write the failing test**

`packages/mcp-servers/browser/__tests__/tools.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';

// Mock playwright
const mockPage = {
  goto: vi.fn().mockResolvedValue(undefined),
  title: vi.fn().mockResolvedValue('Test Page'),
  content: vi.fn().mockResolvedValue('<html><body><h1>Hello</h1></body></html>'),
  close: vi.fn().mockResolvedValue(undefined),
};

const mockBrowser = {
  newPage: vi.fn().mockResolvedValue(mockPage),
  close: vi.fn().mockResolvedValue(undefined),
};

vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue(mockBrowser),
  },
}));

import { BrowserClient } from '../src/tools.js';

describe('BrowserClient', () => {
  describe('scrapePage', () => {
    it('scrapes page title and content', async () => {
      const client = new BrowserClient();
      const result = await client.scrapePage('https://example.com');
      expect(result.title).toBe('Test Page');
      expect(result.content).toContain('<h1>Hello</h1>');
    });
  });

  describe('checkSocial', () => {
    it('returns page content for social analysis', async () => {
      const client = new BrowserClient();
      const result = await client.checkSocial('https://twitter.com/token', 5000);
      expect(result.content).toBeDefined();
      expect(mockPage.goto).toHaveBeenCalledWith('https://twitter.com/token', expect.objectContaining({ timeout: 5000 }));
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run packages/mcp-servers/browser/__tests__/tools.test.ts`
Expected: FAIL

- [ ] **Step 4: Write minimal implementation**

`packages/mcp-servers/browser/src/tools.ts`:
```typescript
import { chromium, type Browser, type Page } from 'playwright';

export interface ScrapeResult {
  title: string;
  content: string;
  url: string;
}

export class BrowserClient {
  private browser: Browser | null = null;

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: true });
    }
    return this.browser;
  }

  async scrapePage(url: string, timeout = 30000): Promise<ScrapeResult> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.goto(url, { timeout, waitUntil: 'domcontentloaded' });
      const [title, content] = await Promise.all([page.title(), page.content()]);
      return { title, content, url };
    } finally {
      await page.close();
    }
  }

  async checkSocial(url: string, timeout = 10000): Promise<ScrapeResult> {
    return this.scrapePage(url, timeout);
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
```

`packages/mcp-servers/browser/src/index.ts`:
```typescript
#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { BrowserClient } from './tools.js';

const client = new BrowserClient();
const server = new McpServer({ name: 'browser', version: '0.1.0' });

server.tool(
  'scrape_page',
  'Scrape a web page and return its content',
  {
    url: z.string().url().describe('URL to scrape'),
    timeout_ms: z.number().optional().describe('Timeout in milliseconds, default 30000'),
  },
  async ({ url, timeout_ms }) => {
    const result = await client.scrapePage(url, timeout_ms);
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'check_social',
  'Check a social media page for sentiment and red flags',
  {
    url: z.string().url().describe('Social media URL to check'),
    timeout_ms: z.number().optional().describe('Timeout in milliseconds, default 10000'),
  },
  async ({ url, timeout_ms }) => {
    const result = await client.checkSocial(url, timeout_ms);
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);

process.on('SIGTERM', () => client.close());
process.on('SIGINT', () => client.close());
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run packages/mcp-servers/browser/__tests__/tools.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/mcp-servers/browser/
git commit -m "feat(mcp): add browser MCP server for web scraping with Playwright"
```

---

### Task 7: git-mcp — GitHub API for Sentiment Repos

**Files:**
- Create: `packages/mcp-servers/git-mcp/package.json`
- Create: `packages/mcp-servers/git-mcp/tsconfig.json`
- Create: `packages/mcp-servers/git-mcp/src/tools.ts`
- Create: `packages/mcp-servers/git-mcp/src/index.ts`
- Create: `packages/mcp-servers/git-mcp/__tests__/tools.test.ts`

- [ ] **Step 1: Create package.json and tsconfig.json**

`packages/mcp-servers/git-mcp/package.json`:
```json
{
  "name": "@trade/mcp-git",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "bin": { "trade-git": "dist/index.js" },
  "scripts": { "build": "tsc", "dev": "tsc --watch", "start": "node dist/index.js" },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "@trade/core": "*",
    "zod": "^3.24.0"
  },
  "devDependencies": { "typescript": "^5.7.0" }
}
```

tsconfig.json: (use template)

- [ ] **Step 2: Write the failing test**

`packages/mcp-servers/git-mcp/__tests__/tools.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { GitHubClient } from '../src/tools.js';

describe('GitHubClient', () => {
  let client: GitHubClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new GitHubClient('test-token');
  });

  describe('searchRepos', () => {
    it('searches GitHub repositories by query', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          total_count: 1,
          items: [
            { full_name: 'user/crypto-sentiment', description: 'Crypto sentiment analysis', html_url: 'https://github.com/user/crypto-sentiment', stargazers_count: 42 },
          ],
        }),
      });

      const repos = await client.searchRepos('crypto sentiment');
      expect(repos).toHaveLength(1);
      expect(repos[0].full_name).toBe('user/crypto-sentiment');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('search/repositories?q=crypto+sentiment'),
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-token' }) })
      );
    });
  });

  describe('getFileContent', () => {
    it('reads file content from a repository', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          content: Buffer.from('line1\nline2\nline3').toString('base64'),
          encoding: 'base64',
        }),
      });

      const content = await client.getFileContent('user/repo', 'data/sentiment.csv');
      expect(content).toBe('line1\nline2\nline3');
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      await expect(client.getFileContent('user/repo', 'missing.txt')).rejects.toThrow('GitHub API error: 404');
    });
  });

  describe('getRepoInfo', () => {
    it('returns repository metadata', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          full_name: 'user/repo',
          description: 'Test repo',
          stargazers_count: 100,
          updated_at: '2026-03-29T00:00:00Z',
        }),
      });

      const info = await client.getRepoInfo('user/repo');
      expect(info.stargazers_count).toBe(100);
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run packages/mcp-servers/git-mcp/__tests__/tools.test.ts`
Expected: FAIL

- [ ] **Step 4: Write minimal implementation**

`packages/mcp-servers/git-mcp/src/tools.ts`:
```typescript
const GITHUB_API = 'https://api.github.com';

export interface RepoInfo {
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  updated_at: string;
}

export class GitHubClient {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github.v3+json',
    };
  }

  async searchRepos(query: string): Promise<RepoInfo[]> {
    const res = await fetch(`${GITHUB_API}/search/repositories?q=${encodeURIComponent(query)}`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
    const data = await res.json() as { items: RepoInfo[] };
    return data.items;
  }

  async getFileContent(repo: string, path: string): Promise<string> {
    const res = await fetch(`${GITHUB_API}/repos/${repo}/contents/${path}`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
    const data = await res.json() as { content: string; encoding: string };
    return Buffer.from(data.content, 'base64').toString('utf-8');
  }

  async getRepoInfo(repo: string): Promise<RepoInfo> {
    const res = await fetch(`${GITHUB_API}/repos/${repo}`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
    return res.json() as Promise<RepoInfo>;
  }
}
```

`packages/mcp-servers/git-mcp/src/index.ts`:
```typescript
#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { GitHubClient } from './tools.js';

const client = new GitHubClient(process.env.GITHUB_TOKEN || '');
const server = new McpServer({ name: 'git-mcp', version: '0.1.0' });

server.tool(
  'search_repos',
  'Search GitHub repositories',
  { query: z.string().describe('Search query') },
  async ({ query }) => {
    const repos = await client.searchRepos(query);
    return { content: [{ type: 'text' as const, text: JSON.stringify(repos, null, 2) }] };
  }
);

server.tool(
  'get_file_content',
  'Read file content from a GitHub repository',
  {
    repo: z.string().describe('Repository in "owner/repo" format'),
    path: z.string().describe('File path within the repository'),
  },
  async ({ repo, path }) => {
    const content = await client.getFileContent(repo, path);
    return { content: [{ type: 'text' as const, text: content }] };
  }
);

server.tool(
  'get_repo_info',
  'Get metadata for a GitHub repository',
  { repo: z.string().describe('Repository in "owner/repo" format') },
  async ({ repo }) => {
    const info = await client.getRepoInfo(repo);
    return { content: [{ type: 'text' as const, text: JSON.stringify(info, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run packages/mcp-servers/git-mcp/__tests__/tools.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/mcp-servers/git-mcp/
git commit -m "feat(mcp): add git-mcp server for GitHub API access"
```

---

### Task 8: bnb-chain — BSC RPC Calls

**Files:**
- Create: `packages/mcp-servers/bnb-chain/package.json`
- Create: `packages/mcp-servers/bnb-chain/tsconfig.json`
- Create: `packages/mcp-servers/bnb-chain/src/tools.ts`
- Create: `packages/mcp-servers/bnb-chain/src/index.ts`
- Create: `packages/mcp-servers/bnb-chain/__tests__/tools.test.ts`

- [ ] **Step 1: Create package.json and tsconfig.json**

`packages/mcp-servers/bnb-chain/package.json`:
```json
{
  "name": "@trade/mcp-bnb-chain",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "bin": { "trade-bnb-chain": "dist/index.js" },
  "scripts": { "build": "tsc", "dev": "tsc --watch", "start": "node dist/index.js" },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "@trade/core": "*",
    "zod": "^3.24.0"
  },
  "devDependencies": { "typescript": "^5.7.0" }
}
```

tsconfig.json: (use template)

- [ ] **Step 2: Write the failing test**

`packages/mcp-servers/bnb-chain/__tests__/tools.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { BscClient } from '../src/tools.js';

describe('BscClient', () => {
  let client: BscClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new BscClient('https://bsc-dataseed.binance.org/');
  });

  describe('getBalance', () => {
    it('returns BNB balance in wei', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ result: '0x4563918244f40000' }),
      });

      const balance = await client.getBalance('0xwallet123');
      expect(balance).toBe('0x4563918244f40000');
    });
  });

  describe('callContract', () => {
    it('calls a smart contract read method', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ result: '0x0000000000000000000000000000000000000000000000000de0b6b3a7640000' }),
      });

      const result = await client.callContract('0xTokenAddr', '0x70a08231', ['0xwallet123']);
      expect(result).toBeDefined();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('eth_call'),
        })
      );
    });
  });

  describe('getTransactionCount', () => {
    it('returns nonce for an address', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ result: '0x5' }),
      });

      const count = await client.getTransactionCount('0xwallet123');
      expect(count).toBe('0x5');
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run packages/mcp-servers/bnb-chain/__tests__/tools.test.ts`
Expected: FAIL

- [ ] **Step 4: Write minimal implementation**

`packages/mcp-servers/bnb-chain/src/tools.ts`:
```typescript
export class BscClient {
  private rpcUrl: string;

  constructor(rpcUrl: string) {
    this.rpcUrl = rpcUrl;
  }

  private async rpcCall(method: string, params: unknown[]): Promise<unknown> {
    const res = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    if (!res.ok) throw new Error(`BSC RPC error: ${res.status}`);
    const data = await res.json() as { result: unknown };
    return data.result;
  }

  async getBalance(address: string): Promise<string> {
    return this.rpcCall('eth_getBalance', [address, 'latest']) as Promise<string>;
  }

  async callContract(contractAddress: string, data: string, toAddress?: string[]): Promise<string> {
    const params: unknown[] = [
      { to: contractAddress, data },
      'latest',
    ];
    return this.rpcCall('eth_call', params) as Promise<string>;
  }

  async getTransactionCount(address: string): Promise<string> {
    return this.rpcCall('eth_getTransactionCount', [address, 'latest']) as Promise<string>;
  }
}
```

`packages/mcp-servers/bnb-chain/src/index.ts`:
```typescript
#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { BscClient } from './tools.js';

const rpcUrl = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/';
const client = new BscClient(rpcUrl);
const server = new McpServer({ name: 'bnb-chain', version: '0.1.0' });

server.tool(
  'get_balance',
  'Get BNB balance for an address',
  { address: z.string().describe('BSC wallet address') },
  async ({ address }) => {
    const balance = await client.getBalance(address);
    const bnb = parseInt(balance, 16) / 1e18;
    return { content: [{ type: 'text' as const, text: JSON.stringify({ wei: balance, bnb }, null, 2) }] };
  }
);

server.tool(
  'call_contract',
  'Call a BSC smart contract read method',
  {
    contract_address: z.string().describe('Contract address'),
    data: z.string().describe('Encoded function call data'),
  },
  async ({ contract_address, data }) => {
    const result = await client.callContract(contract_address, data);
    return { content: [{ type: 'text' as const, text: JSON.stringify({ result }, null, 2) }] };
  }
);

server.tool(
  'get_transaction_count',
  'Get transaction count (nonce) for an address',
  { address: z.string().describe('BSC wallet address') },
  async ({ address }) => {
    const count = await client.getTransactionCount(address);
    return { content: [{ type: 'text' as const, text: JSON.stringify({ nonce: count }, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run packages/mcp-servers/bnb-chain/__tests__/tools.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/mcp-servers/bnb-chain/
git commit -m "feat(mcp): add bnb-chain MCP server for BSC RPC calls"
```

---

### Task 9: jupiter — Solana DEX Aggregator

**Files:**
- Create: `packages/mcp-servers/jupiter/package.json`
- Create: `packages/mcp-servers/jupiter/tsconfig.json`
- Create: `packages/mcp-servers/jupiter/src/tools.ts`
- Create: `packages/mcp-servers/jupiter/src/index.ts`
- Create: `packages/mcp-servers/jupiter/__tests__/tools.test.ts`

- [ ] **Step 1: Create package.json and tsconfig.json**

`packages/mcp-servers/jupiter/package.json`:
```json
{
  "name": "@trade/mcp-jupiter",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "bin": { "trade-jupiter": "dist/index.js" },
  "scripts": { "build": "tsc", "dev": "tsc --watch", "start": "node dist/index.js" },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "@trade/core": "*",
    "zod": "^3.24.0"
  },
  "devDependencies": { "typescript": "^5.7.0" }
}
```

tsconfig.json: (use template)

- [ ] **Step 2: Write the failing test**

`packages/mcp-servers/jupiter/__tests__/tools.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { JupiterClient } from '../src/tools.js';

describe('JupiterClient', () => {
  let client: JupiterClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new JupiterClient();
  });

  describe('getQuote', () => {
    it('returns a swap quote for a token pair', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          inputMint: 'So11111111111111111111111111111111111111112',
          outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          inAmount: '100000000',
          outAmount: '5670000',
          priceImpactPct: 0.12,
        }),
      });

      const quote = await client.getQuote({
        inputMint: 'So11111111111111111111111111111111111111112',
        outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        amount: 100000000,
      });
      expect(quote.outAmount).toBe('5670000');
      expect(quote.priceImpactPct).toBe(0.12);
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 400 });
      await expect(client.getQuote({
        inputMint: 'So1', outputMint: 'EPj', amount: 100,
      })).rejects.toThrow('Jupiter API error: 400');
    });
  });

  describe('getRoutes', () => {
    it('returns available swap routes', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          routesSummary: [
            { inAmount: '100000000', outAmount: '5600000', kind: 'Route' },
            { inAmount: '100000000', outAmount: '5550000', kind: 'Route' },
          ],
        }),
      });

      const routes = await client.getRoutes({
        inputMint: 'So1', outputMint: 'EPj', amount: 100000000,
      });
      expect(routes.routesSummary).toHaveLength(2);
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run packages/mcp-servers/jupiter/__tests__/tools.test.ts`
Expected: FAIL

- [ ] **Step 4: Write minimal implementation**

`packages/mcp-servers/jupiter/src/tools.ts`:
```typescript
const JUPITER_API = 'https://quote-api.jup.ag/v6';

export interface QuoteRequest {
  inputMint: string;
  outputMint: string;
  amount: number;
}

export interface Quote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: number;
}

export interface RoutesResult {
  routesSummary: Array<{ inAmount: string; outAmount: string; kind: string }>;
}

export class JupiterClient {
  async getQuote(req: QuoteRequest): Promise<Quote> {
    const params = new URLSearchParams({
      inputMint: req.inputMint,
      outputMint: req.outputMint,
      amount: String(req.amount),
    });
    const res = await fetch(`${JUPITER_API}/quote?${params}`);
    if (!res.ok) throw new Error(`Jupiter API error: ${res.status}`);
    return res.json() as Promise<Quote>;
  }

  async getRoutes(req: QuoteRequest): Promise<RoutesResult> {
    const params = new URLSearchParams({
      inputMint: req.inputMint,
      outputMint: req.outputMint,
      amount: String(req.amount),
    });
    const res = await fetch(`${JUPITER_API}/routes?${params}`);
    if (!res.ok) throw new Error(`Jupiter API error: ${res.status}`);
    return res.json() as Promise<RoutesResult>;
  }
}
```

`packages/mcp-servers/jupiter/src/index.ts`:
```typescript
#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { JupiterClient } from './tools.js';

const client = new JupiterClient();
const server = new McpServer({ name: 'jupiter', version: '0.1.0' });

server.tool(
  'get_quote',
  'Get a swap quote from Jupiter DEX aggregator',
  {
    input_mint: z.string().describe('Input token mint address'),
    output_mint: z.string().describe('Output token mint address'),
    amount: z.number().positive().describe('Amount in smallest token unit'),
  },
  async ({ input_mint, output_mint, amount }) => {
    const quote = await client.getQuote({ inputMint: input_mint, outputMint: output_mint, amount });
    return { content: [{ type: 'text' as const, text: JSON.stringify(quote, null, 2) }] };
  }
);

server.tool(
  'get_routes',
  'Get available swap routes from Jupiter',
  {
    input_mint: z.string().describe('Input token mint address'),
    output_mint: z.string().describe('Output token mint address'),
    amount: z.number().positive().describe('Amount in smallest token unit'),
  },
  async ({ input_mint, output_mint, amount }) => {
    const routes = await client.getRoutes({ inputMint: input_mint, outputMint: output_mint, amount });
    return { content: [{ type: 'text' as const, text: JSON.stringify(routes, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run packages/mcp-servers/jupiter/__tests__/tools.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/mcp-servers/jupiter/
git commit -m "feat(mcp): add jupiter MCP server for Solana DEX aggregation"
```

---

### Task 10: 1inch — EVM DEX Aggregator

**Files:**
- Create: `packages/mcp-servers/1inch/package.json`
- Create: `packages/mcp-servers/1inch/tsconfig.json`
- Create: `packages/mcp-servers/1inch/src/tools.ts`
- Create: `packages/mcp-servers/1inch/src/index.ts`
- Create: `packages/mcp-servers/1inch/__tests__/tools.test.ts`

- [ ] **Step 1: Create package.json and tsconfig.json**

`packages/mcp-servers/1inch/package.json`:
```json
{
  "name": "@trade/mcp-1inch",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "bin": { "trade-1inch": "dist/index.js" },
  "scripts": { "build": "tsc", "dev": "tsc --watch", "start": "node dist/index.js" },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "@trade/core": "*",
    "zod": "^3.24.0"
  },
  "devDependencies": { "typescript": "^5.7.0" }
}
```

tsconfig.json: (use template)

- [ ] **Step 2: Write the failing test**

`packages/mcp-servers/1inch/__tests__/tools.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { OneInchClient } from '../src/tools.js';

describe('OneInchClient', () => {
  let client: OneInchClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new OneInchClient('test-api-key', 56);
  });

  describe('getQuote', () => {
    it('returns a swap quote for a token pair on BSC', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          fromToken: { symbol: 'BNB', address: '0x...bnb' },
          toToken: { symbol: 'BUSD', address: '0x...busd' },
          fromTokenAmount: '1000000000000000000',
          toTokenAmount: '580000000000000000000',
          estimatedGas: 150000,
        }),
      });

      const quote = await client.getQuote('0xWBNB', '0xBUSD', '1000000000000000000');
      expect(quote.toTokenAmount).toBe('580000000000000000000');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/swap/v6.0/56/quote'),
        expect.anything()
      );
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 400 });
      await expect(client.getQuote('0xA', '0xB', '1')).rejects.toThrow('1inch API error: 400');
    });
  });

  describe('getSpender', () => {
    it('returns the 1inch spender address', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ address: '0x1111111254eeb25477b68fb85ed929f73a960582' }),
      });

      const spender = await client.getSpender();
      expect(spender).toBe('0x1111111254eeb25477b68fb85ed929f73a960582');
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run packages/mcp-servers/1inch/__tests__/tools.test.ts`
Expected: FAIL

- [ ] **Step 4: Write minimal implementation**

`packages/mcp-servers/1inch/src/tools.ts`:
```typescript
const ONEINCH_API = 'https://api.1inch.dev/swap/v6.0';

export interface SwapQuote {
  fromToken: { symbol: string; address: string };
  toToken: { symbol: string; address: string };
  fromTokenAmount: string;
  toTokenAmount: string;
  estimatedGas: number;
}

export class OneInchClient {
  private apiKey: string;
  private chainId: number;

  constructor(apiKey: string, chainId = 56) {
    this.apiKey = apiKey;
    this.chainId = chainId;
  }

  private headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.apiKey}` };
  }

  async getQuote(fromTokenAddress: string, toTokenAddress: string, amount: string): Promise<SwapQuote> {
    const params = new URLSearchParams({
      src: fromTokenAddress,
      dst: toTokenAddress,
      amount,
    });
    const res = await fetch(`${ONEINCH_API}/${this.chainId}/quote?${params}`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`1inch API error: ${res.status}`);
    return res.json() as Promise<SwapQuote>;
  }

  async getSpender(): Promise<string> {
    const res = await fetch(`${ONEINCH_API}/${this.chainId}/approve/spender`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`1inch API error: ${res.status}`);
    const data = await res.json() as { address: string };
    return data.address;
  }
}
```

`packages/mcp-servers/1inch/src/index.ts`:
```typescript
#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { OneInchClient } from './tools.js';

const chainId = Number(process.env.CHAIN_ID) || 56;
const client = new OneInchClient(process.env.ONEINCH_API_KEY || '', chainId);
const server = new McpServer({ name: '1inch', version: '0.1.0' });

server.tool(
  'get_quote',
  'Get a swap quote from 1inch DEX aggregator',
  {
    from_token: z.string().describe('Source token address'),
    to_token: z.string().describe('Destination token address'),
    amount: z.string().describe('Amount in wei (smallest unit)'),
  },
  async ({ from_token, to_token, amount }) => {
    const quote = await client.getQuote(from_token, to_token, amount);
    return { content: [{ type: 'text' as const, text: JSON.stringify(quote, null, 2) }] };
  }
);

server.tool(
  'get_spender',
  'Get the 1inch spender address for token approval',
  {},
  async () => {
    const spender = await client.getSpender();
    return { content: [{ type: 'text' as const, text: JSON.stringify({ spender }, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run packages/mcp-servers/1inch/__tests__/tools.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/mcp-servers/1inch/
git commit -m "feat(mcp): add 1inch MCP server for EVM DEX aggregation"
```

---

### Task 11: polymarket — Prediction Market CLOB

**Files:**
- Create: `packages/mcp-servers/polymarket/package.json`
- Create: `packages/mcp-servers/polymarket/tsconfig.json`
- Create: `packages/mcp-servers/polymarket/src/tools.ts`
- Create: `packages/mcp-servers/polymarket/src/index.ts`
- Create: `packages/mcp-servers/polymarket/__tests__/tools.test.ts`

- [ ] **Step 1: Create package.json and tsconfig.json**

`packages/mcp-servers/polymarket/package.json`:
```json
{
  "name": "@trade/mcp-polymarket",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "bin": { "trade-polymarket": "dist/index.js" },
  "scripts": { "build": "tsc", "dev": "tsc --watch", "start": "node dist/index.js" },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "@trade/core": "*",
    "zod": "^3.24.0"
  },
  "devDependencies": { "typescript": "^5.7.0" }
}
```

tsconfig.json: (use template)

- [ ] **Step 2: Write the failing test**

`packages/mcp-servers/polymarket/__tests__/tools.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { PolymarketClient } from '../src/tools.js';

describe('PolymarketClient', () => {
  let client: PolymarketClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new PolymarketClient('test-api-key', 'test-private-key');
  });

  describe('getMarkets', () => {
    it('returns active markets', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          { condition_id: '0xabc', question: 'Will BTC hit 100k?', outcomes: ['Yes', 'No'], active: true },
          { condition_id: '0xdef', question: 'ETH above 5k?', outcomes: ['Yes', 'No'], active: true },
        ]),
      });

      const markets = await client.getMarkets();
      expect(markets).toHaveLength(2);
      expect(markets[0].question).toBe('Will BTC hit 100k?');
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
      await expect(client.getMarkets()).rejects.toThrow('Polymarket API error: 401');
    });
  });

  describe('getOrderbook', () => {
    it('returns orderbook for a market', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          bids: [{ price: 0.55, size: 100 }],
          asks: [{ price: 0.58, size: 200 }],
        }),
      });

      const book = await client.getOrderbook('token-id-123');
      expect(book.bids).toHaveLength(1);
      expect(book.asks[0].price).toBe(0.58);
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run packages/mcp-servers/polymarket/__tests__/tools.test.ts`
Expected: FAIL

- [ ] **Step 4: Write minimal implementation**

`packages/mcp-servers/polymarket/src/tools.ts`:
```typescript
const POLY_API = 'https://clob.polymarket.com';

export interface Market {
  condition_id: string;
  question: string;
  outcomes: string[];
  active: boolean;
}

export interface OrderbookEntry {
  price: number;
  size: number;
}

export interface Orderbook {
  bids: OrderbookEntry[];
  asks: OrderbookEntry[];
}

export class PolymarketClient {
  private apiKey: string;
  private privateKey: string;

  constructor(apiKey: string, privateKey: string) {
    this.apiKey = apiKey;
    this.privateKey = privateKey;
  }

  private headers(): Record<string, string> {
    return {
      'POLY_API_KEY': this.apiKey,
      'POLY_SECRET': this.privateKey,
      'Content-Type': 'application/json',
    };
  }

  async getMarkets(): Promise<Market[]> {
    const res = await fetch(`${POLY_API}/markets`, { headers: this.headers() });
    if (!res.ok) throw new Error(`Polymarket API error: ${res.status}`);
    return res.json() as Promise<Market[]>;
  }

  async getOrderbook(tokenId: string): Promise<Orderbook> {
    const res = await fetch(`${POLY_API}/book?token_id=${tokenId}`);
    if (!res.ok) throw new Error(`Polymarket API error: ${res.status}`);
    return res.json() as Promise<Orderbook>;
  }
}
```

`packages/mcp-servers/polymarket/src/index.ts`:
```typescript
#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { PolymarketClient } from './tools.js';

const client = new PolymarketClient(
  process.env.POLYMARKET_API_KEY || '',
  process.env.POLYMARKET_PRIVATE_KEY || ''
);
const server = new McpServer({ name: 'polymarket', version: '0.1.0' });

server.tool(
  'get_markets',
  'Get active prediction markets from Polymarket',
  {},
  async () => {
    const markets = await client.getMarkets();
    return { content: [{ type: 'text' as const, text: JSON.stringify(markets, null, 2) }] };
  }
);

server.tool(
  'get_orderbook',
  'Get the orderbook for a Polymarket token',
  { token_id: z.string().describe('Polymarket token ID') },
  async ({ token_id }) => {
    const book = await client.getOrderbook(token_id);
    return { content: [{ type: 'text' as const, text: JSON.stringify(book, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run packages/mcp-servers/polymarket/__tests__/tools.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/mcp-servers/polymarket/
git commit -m "feat(mcp): add polymarket MCP server for prediction market trading"
```

---

### Task 12: npm install and Full Test Suite Verification

- [ ] **Step 1: Install all dependencies**

Run: `npm install`

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: ALL PASS (core tests + 11 new MCP server tests + risk-manager test)

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install all MCP server dependencies"
```
