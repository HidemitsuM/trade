# MCP Trading Orchestrator - Full System Design

## Overview

A fully automated crypto trading system with 8 trading agents orchestrated through 12 MCP servers, powered by Claude Code. Agents communicate via a signal bus, with centralized risk management and a phased deployment from simulation to live trading.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Orchestrator (Agent)                │
│   Claude Code manages agent lifecycle & coordination │
│   Signal Bus (Redis Pub/Sub) for inter-agent comms  │
└────────┬────────┬────────┬────────┬─────────────────┘
         │        │        │        │
    ┌────▼──┐ ┌───▼───┐ ┌──▼───┐ ┌─▼──────────┐
    │arb    │ │pump   │ │spread│ │whale/copy/  │
    │scanner│ │sniper │ │farmer│ │news agents  │
    └───┬───┘ └───┬───┘ └──┬───┘ └──────┬──────┘
        │         │        │            │
        ▼         ▼        ▼            ▼
┌─────────────────────────────────────────────────────┐
│                  MCP Server Layer (12 servers)       │
└─────────────────────────────────────────────────────┘
         │         │        │            │
         ▼         ▼        ▼            ▼
┌─────────────────────────────────────────────────────┐
│              Blockchain / Market APIs                │
└─────────────────────────────────────────────────────┘
```

### Key Design Decisions

- **Monorepo**: All packages in a single repo with TypeScript workspaces
- **MCP Protocol**: Each external service integration is a standalone MCP server
- **Signal Bus**: Redis Pub/Sub for agent-to-agent communication
- **Orchestrator**: Claude Code session that manages agent lifecycle
- **Risk Management**: Centralized in `risk-manager` MCP server and `portfolio-guard` agent

## Tech Stack

- **Language**: TypeScript (Node.js)
- **MCP SDK**: `@modelcontextprotocol/sdk`
- **LLM**: Claude Code + MCP CLI
- **Database**: SQLite (Phase 1-2), PostgreSQL (Phase 3)
- **Signal Bus**: Redis Pub/Sub
- **Containerization**: Docker Compose
- **Build**: npm workspaces / turborepo

## 12 MCP Servers

| # | Server | Role | Chain | External API |
|---|---|---|---|---|
| 1 | helius | Solana RPC, tx monitoring, WebSocket | Solana | Helius API |
| 2 | dune | On-chain data queries & analytics | All chains | Dune Analytics API |
| 3 | phantom | Wallet operations, signing, transfers | Solana | Phantom Wallet |
| 4 | coinmarketcap | Price, market cap, Fear & Greed index | All | CMC API |
| 5 | coingecko | Price, liquidity, chain-specific data | All | CoinGecko API |
| 6 | browser | Web scraping, social checks | - | Playwright MCP |
| 7 | git-mcp | Sentiment repos, data retrieval | - | GitHub API |
| 8 | bnb-chain | BSC RPC, contract calls | BNB Chain | BSC RPC |
| 9 | jupiter | Solana DEX aggregator, swaps | Solana | Jupiter API |
| 10 | 1inch | EVM DEX aggregator, swaps | EVM chains | 1inch API |
| 11 | polymarket | Prediction market orderbook, CLOB | Polymarket | Polymarket CLOB API |
| 12 | risk-manager | Risk calculation, exposure management, circuit breaker | All | Internal |

### MCP Server Implementation Pattern

Each MCP server follows this structure:

```
packages/mcp-servers/<name>/
├── src/
│   ├── index.ts          # MCP server entry point
│   ├── tools.ts          # Tool definitions
│   ├── client.ts         # External API client
│   └── types.ts          # Type definitions
├── package.json
└── tsconfig.json
```

Each server exposes tools via MCP protocol:
- `helius`: `get_transaction`, `watch_wallet`, `get_token_info`, `subscribe_events`
- `dune`: `run_query`, `get_query_results`, `list_queries`
- `phantom`: `get_balance`, `send_transaction`, `sign_message`, `get_token_accounts`
- `coinmarketcap`: `get_price`, `get_market_cap`, `get_fear_greed`
- `coingecko`: `get_price`, `get_liquidity`, `get_trending`, `get_token_info`
- `browser`: `scrape_page`, `check_social`, `search_twitter`
- `git-mcp`: `read_repo`, `search_repos`, `get_file_content`
- `bnb-chain`: `get_balance`, `call_contract`, `send_transaction`
- `jupiter`: `get_quote`, `execute_swap`, `get_routes`
- `1inch`: `get_quote`, `execute_swap`, `get_spender`
- `polymarket`: `get_markets`, `get_orderbook`, `place_order`, `cancel_order`
- `risk-manager`: `check_exposure`, `calculate_pnl`, `circuit_breaker_status`, `update_thresholds`

## 8 Trading Agents

### Agent 1: arb-scanner
- **Strategy**: DEX arbitrage across chains
- **Flow**: Price gap detection (helius/jupiter/1inch) → on-chain confirmation (dune) → execution (phantom/bnb-chain)
- **Config**: `min_profit_usd: 5`, `chains: [solana, bsc]`

### Agent 2: pump-sniper
- **Strategy**: New token discovery and early sniping
- **Flow**: New token detection (helius) → liquidity check (coingecko) → social red flags (browser) → buy
- **Config**: `max_position_usd: 200`

### Agent 3: spread-farmer
- **Strategy**: Polymarket spread harvesting
- **Flow**: Orderbook analysis (polymarket) → both sides placement → spread collection
- **Config**: `min_spread_pct: 2`, `max_positions: 10`

### Agent 4: whale-tracker
- **Strategy**: Large wallet monitoring and signal broadcasting
- **Flow**: Whale detection (dune/helius/bnb-chain) → signal broadcast to other agents
- **Config**: `min_whale_usd: 10000`, `watched_wallets: []`

### Agent 5: copy-trader
- **Strategy**: Mirror whale positions
- **Flow**: Receives whale signals → mirror position via phantom/1inch
- **Config**: `max_copy_usd: 300`, `copy_delay_ms: 2000`

### Agent 6: news-edge
- **Strategy**: News sentiment pre-crowd entry
- **Flow**: Sentiment analysis (git-mcp) → Fear & Greed cross-reference (coinmarketcap) → entry
- **Config**: `sentiment_threshold: 0.7`

### Agent 7: liquidity-hunter
- **Strategy**: Liquidity pool change detection for front-running
- **Flow**: LP change detection (helius/dune) → optimal route calculation (jupiter) → execution
- **Config**: `min_liquidity_change_pct: 5`

### Agent 8: portfolio-guard
- **Strategy**: Portfolio rebalancing, stop-loss, circuit breaker
- **Flow**: Continuous monitoring → auto-rebalance → circuit breaker trigger
- **Config**: `rebalance_threshold_pct: 5`, `stop_loss_pct: 8`

### Agent Inter-communication Patterns

```
whale-tracker ──signal──→ copy-trader → execute
                       → arb-scanner → arb opportunity from whale move

pump-sniper ──new token──→ news-edge → sentiment eval
                         → portfolio-guard → risk cap check

ALL agents ──every trade──→ portfolio-guard → total exposure monitor
```

## Data Structure

### SQLite Schema (Phase 1-2)

```sql
CREATE TABLE trade_log (
  id TEXT PRIMARY KEY,
  agent TEXT NOT NULL,
  pair TEXT NOT NULL,
  side TEXT NOT NULL,  -- 'buy' | 'sell'
  entry_price REAL,
  exit_price REAL,
  quantity REAL,
  pnl REAL,
  fee REAL,
  chain TEXT,
  tx_hash TEXT,
  simulated BOOLEAN DEFAULT true,
  timestamp TEXT DEFAULT (datetime('now'))
);

CREATE TABLE signal_log (
  id TEXT PRIMARY KEY,
  source_agent TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  data_json TEXT NOT NULL,
  confidence REAL,
  consumed_by TEXT,  -- comma-separated agent names
  timestamp TEXT DEFAULT (datetime('now'))
);

CREATE TABLE wallet_state (
  id TEXT PRIMARY KEY,
  chain TEXT NOT NULL,
  address TEXT NOT NULL,
  balance_json TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE agent_state (
  id TEXT PRIMARY KEY,
  agent_name TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL,  -- 'idle' | 'running' | 'error' | 'stopped'
  config_json TEXT,
  last_heartbeat TEXT,
  total_pnl REAL DEFAULT 0,
  trade_count INTEGER DEFAULT 0
);

CREATE TABLE risk_state (
  id TEXT PRIMARY KEY,
  metric TEXT NOT NULL,
  value REAL NOT NULL,
  threshold REAL NOT NULL,
  breached BOOLEAN DEFAULT false,
  timestamp TEXT DEFAULT (datetime('now'))
);
```

### Configuration

```yaml
# config/default.yaml
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

agents:
  arb-scanner:
    enabled: true
    chains: [solana, bsc]
    min_profit_usd: 5
    scan_interval_ms: 3000
  pump-sniper:
    enabled: true
    max_position_usd: 200
    max_open_positions: 3
  spread-farmer:
    enabled: true
    min_spread_pct: 2
    max_positions: 10
  whale-tracker:
    enabled: true
    min_whale_usd: 10000
    watched_wallets: []
  copy-trader:
    enabled: true
    max_copy_usd: 300
    copy_delay_ms: 2000
  news-edge:
    enabled: true
    sentiment_threshold: 0.7
    scan_interval_ms: 60000
  liquidity-hunter:
    enabled: true
    min_liquidity_change_pct: 5
  portfolio-guard:
    enabled: true
    rebalance_threshold_pct: 5
    stop_loss_pct: 8
    check_interval_ms: 5000

mcp_servers:
  helius:
    api_key: ${HELIUS_API_KEY}
  dune:
    api_key: ${DUNE_API_KEY}
  coinmarketcap:
    api_key: ${CMC_API_KEY}
  coingecko:
    api_key: ${COINGECKO_API_KEY}
  phantom:
    wallet_private_key: ${PHANTOM_PRIVATE_KEY}
  bnb-chain:
    rpc_url: ${BSC_RPC_URL}
  polymarket:
    api_key: ${POLYMARKET_API_KEY}
    private_key: ${POLYMARKET_PRIVATE_KEY}
```

## Docker Compose

```yaml
services:
  orchestrator:
    build: .
    command: node packages/orchestrator/dist/index.js
    environment:
      - REDIS_URL=redis://redis:6379
      - SIMULATION=true
    depends_on:
      - redis
    volumes:
      - ./data:/app/data
      - ./config:/app/config

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  dashboard:
    build:
      context: .
      dockerfile: packages/dashboard/Dockerfile
    ports:
      - "3000:3000"
    depends_on:
      - redis
    environment:
      - REDIS_URL=redis://redis:6379
```

## Phased Deployment

### Phase 1: Simulation (Week 1-2)
- All agents run in simulation mode
- Real API data, simulated execution
- Validate P&L, win rate, Sharpe ratio
- Portfolio-guard monitors simulated trades

### Phase 2: Paper Trading (Week 3)
- Generate real orders without sending
- Accurate slippage and fee modeling
- Verify against live market conditions

### Phase 3: Live Trading (Week 4+)
- Start with 1 agent (arb-scanner)
- Strict risk limits ($500 max exposure)
- Gradually enable more agents
- 24/7 monitoring required

## Project Structure

```
trade/
├── packages/
│   ├── core/                    # Shared library
│   │   ├── src/
│   │   │   ├── types.ts         # Shared types
│   │   │   ├── logger.ts        # Logging utility
│   │   │   ├── config.ts        # Config loader
│   │   │   ├── db.ts            # Database client
│   │   │   ├── signal-bus.ts    # Redis Pub/Sub wrapper
│   │   │   └── utils.ts         # Shared utilities
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── mcp-servers/             # 12 MCP servers
│   │   ├── helius/
│   │   ├── dune/
│   │   ├── phantom/
│   │   ├── coinmarketcap/
│   │   ├── coingecko/
│   │   ├── browser/
│   │   ├── git-mcp/
│   │   ├── bnb-chain/
│   │   ├── jupiter/
│   │   ├── 1inch/
│   │   ├── polymarket/
│   │   └── risk-manager/
│   ├── agents/                  # 8 trading agents
│   │   ├── arb-scanner/
│   │   ├── pump-sniper/
│   │   ├── spread-farmer/
│   │   ├── whale-tracker/
│   │   ├── copy-trader/
│   │   ├── news-edge/
│   │   ├── liquidity-hunter/
│   │   └── portfolio-guard/
│   ├── orchestrator/            # Central orchestrator
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── agent-manager.ts
│   │   │   └── scheduler.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── dashboard/               # Web UI
│       ├── src/
│       ├── package.json
│       └── tsconfig.json
├── config/
│   └── default.yaml
├── docker-compose.yml
├── package.json                  # Workspace root
├── tsconfig.json
└── .env.example
```

## Risk Management

### Hard Limits (circuit breaker)
- Max total exposure: $5,000
- Max single trade: $500
- Max daily loss: $300
- Circuit breaker loss: $200 (pauses all agents)
- Max drawdown: 10% from peak balance

### Soft Limits (warnings)
- Single agent exposure > 30% of total
- Win rate drops below 60%
- Sharpe ratio drops below 1.5

### Safety Measures
- Every trade logged with full context
- portfolio-guard runs on 5-second intervals
- All agent actions require risk-manager approval
- Emergency stop command via Redis channel
