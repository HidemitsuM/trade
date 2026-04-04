# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test Commands

```bash
npm run build          # Compile all workspace packages
npm test               # Run all tests (vitest run)
npm run test:watch     # Watch mode
npx vitest run packages/core/__tests__/db.test.ts          # Single test file
npx vitest run packages/agents/arb-scanner/__tests__/      # Single package tests
```

Tests use vitest. Workspace imports resolve via aliases in `vitest.config.ts` — `@trade/core` maps to `packages/core/src/index.ts`, `@trade/agent-*` maps to each agent's `agent.js`.

## Architecture

Monorepo with npm workspaces. TypeScript, ESM (`"type": "module"`), Node16 module resolution.

### Layers

```
packages/core/          → Shared types, Database (SQLite/better-sqlite3), SignalBus (Redis/ioredis), BaseAgent, config loader, logger
packages/mcp-servers/*  → 12 standalone MCP servers (each is a stdio-based MCP server using @modelcontextprotocol/sdk + zod)
packages/agents/*       → 8 trading agents (each extends BaseAgent, contains a Strategy class with pure logic + an Agent class with lifecycle)
packages/orchestrator/  → AgentManager registers/start/stops agents; main index wires all 8 agents
packages/dashboard/     → HTTP server (no framework) serving HTML dashboard, querying Database for P&L/trade data
```

### Key Patterns

**MCP Server pattern**: Every MCP server has `src/tools.ts` (business logic class with mocked-fetch tests) and `src/index.ts` (McpServer + StdioServerTransport + tool registration). All use `zod` for input validation. Tests mock `fetch` globally via `vi.stubGlobal('fetch', mockFetch)`.

**Agent pattern**: Every agent has `src/strategy.ts` (pure function class, no external deps, fully testable) and `src/agent.ts` (extends BaseAgent, interval-based tick, signal handlers). The Strategy layer is what gets unit-tested; the Agent layer wires Strategy to the outside world.

**BaseAgent** (`packages/core/src/base-agent.ts`): Abstract class providing `start()`/`stop()` lifecycle with `setInterval`, `publishSignal()` for creating Signal objects, and abstract `tick()`/`onSignal()` methods. Currently publishes signals to log only — SignalBus integration is a pending issue.

### Signal Types (defined in `packages/core/src/types.ts`)

`price_gap`, `new_token`, `whale_move`, `liquidity_change`, `sentiment_shift`, `spread_opportunity`, `risk_breach`, `trade_executed`

### Inter-Agent Communication (design intent)

Agents should communicate via `SignalBus` (Redis Pub/Sub). Flow: Agent A publishes → Redis channel `signal:{type}` → Agent B's onSignal() receives. This is the intended pattern but not yet wired up.

### Configuration

`config/default.yaml` loads via `packages/core/src/config.ts` using `zod` validation. Environment variables override YAML defaults (see `.env.example`). Agent configs are env-var driven in `packages/orchestrator/src/index.ts`.

### Database

SQLite via `better-sqlite3`. Schema in `packages/core/src/db.ts` — tables: `trade_log`, `signal_log`, `agent_state`, `risk_state`, `wallet_state`. All write operations are synchronous (better-sqlite3 API). Tests use `:memory:` databases.

## Known Gaps

The codebase is a working skeleton (82 tests pass) but agents have empty `tick()` stubs and don't connect to MCP servers or SignalBus at runtime. See GitHub issues #1–#13 in `HidemitsuM/trade` for the implementation roadmap.
