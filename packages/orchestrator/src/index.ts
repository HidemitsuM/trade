#!/usr/bin/env node
import { logger, Database, SignalBus, SimulationEngine, MCPConnectionPool, WalletManager } from '@trade/core';
import { AgentManager } from './agent-manager.js';

// Import all agents
import { ArbScannerAgent } from '@trade/agent-arb-scanner/agent.js';
import { PumpSniperAgent } from '@trade/agent-pump-sniper/agent.js';
import { SpreadFarmerAgent } from '@trade/agent-spread-farmer/agent.js';
import { WhaleTrackerAgent } from '@trade/agent-whale-tracker/agent.js';
import { CopyTraderAgent } from '@trade/agent-copy-trader/agent.js';
import { NewsEdgeAgent } from '@trade/agent-news-edge/agent.js';
import { LiquidityHunterAgent } from '@trade/agent-liquidity-hunter/agent.js';
import { PortfolioGuardAgent } from '@trade/agent-portfolio-guard/agent.js';

const isSimulation = process.env.SIMULATION !== 'false';
const walletAddress = process.env.WALLET_ADDRESS || '';

// Initialize infrastructure
const db = new Database(process.env.DB_PATH || './data/trade.db');
db.initialize();

const signalBus = new SignalBus(process.env.REDIS_URL || 'redis://localhost:6379');
const simulation = new SimulationEngine();

// Initialize MCP connection pool and WalletManager when not in simulation
let mcpPool: MCPConnectionPool | undefined;
let wallet: WalletManager | undefined;

if (!isSimulation) {
  mcpPool = new MCPConnectionPool();

  mcpPool.register('coingecko', {
    command: 'node',
    args: ['packages/mcp-servers/coingecko/dist/index.js'],
    env: { COINGECKO_API_KEY: process.env.COINGECKO_API_KEY || '' },
  });

  mcpPool.register('coinmarketcap', {
    command: 'node',
    args: ['packages/mcp-servers/coinmarketcap/dist/index.js'],
    env: { CMC_API_KEY: process.env.CMC_API_KEY || '' },
  });

  mcpPool.register('helius', {
    command: 'node',
    args: ['packages/mcp-servers/helius/dist/index.js'],
    env: { HELIUS_RPC_URL: process.env.HELIUS_RPC_URL || '' },
  });

  mcpPool.register('jupiter', {
    command: 'node',
    args: ['packages/mcp-servers/jupiter/dist/index.js'],
  });

  mcpPool.register('1inch', {
    command: 'node',
    args: ['packages/mcp-servers/1inch/dist/index.js'],
    env: { ONEINCH_API_KEY: process.env.ONEINCH_API_KEY || '' },
  });

  mcpPool.register('phantom', {
    command: 'node',
    args: ['packages/mcp-servers/phantom/dist/index.js'],
    env: {
      HELIUS_RPC_URL: process.env.HELIUS_RPC_URL || '',
      PHANTOM_PRIVATE_KEY: process.env.PHANTOM_PRIVATE_KEY || '',
    },
  });

  // Initialize wallet if address is provided
  if (walletAddress) {
    wallet = new WalletManager({ mcpPool, db, walletAddress, chain: 'solana' });
    logger.info('WalletManager initialized', { address: walletAddress, chain: 'solana' });
  } else {
    logger.warn('WALLET_ADDRESS not set — wallet features disabled');
  }
}

const manager = new AgentManager();

const arbScanner = new ArbScannerAgent({
  min_profit_usd: Number(process.env.ARB_MIN_PROFIT_USD) || 5,
  chains: (process.env.ARB_CHAINS || 'solana,bsc').split(','),
});
arbScanner.setInfrastructure({ db, signalBus, simulation, mcpPool, isSimulation });
manager.register('arb-scanner', arbScanner);

const pumpSniper = new PumpSniperAgent({
  max_position_usd: Number(process.env.PUMP_MAX_POSITION_USD) || 200,
  max_open_positions: Number(process.env.PUMP_MAX_POSITIONS) || 3,
});
pumpSniper.setInfrastructure({ db, signalBus, simulation, mcpPool, isSimulation });
manager.register('pump-sniper', pumpSniper);

const spreadFarmer = new SpreadFarmerAgent({
  min_spread_pct: Number(process.env.SPREAD_MIN_PCT) || 2,
  max_positions: Number(process.env.SPREAD_MAX_POSITIONS) || 10,
});
spreadFarmer.setInfrastructure({ db, signalBus, simulation, mcpPool, isSimulation });
manager.register('spread-farmer', spreadFarmer);

const whaleTracker = new WhaleTrackerAgent({
  min_whale_usd: Number(process.env.WHALE_MIN_USD) || 10000,
});
whaleTracker.setInfrastructure({ db, signalBus, simulation, mcpPool, isSimulation });
manager.register('whale-tracker', whaleTracker);

const copyTrader = new CopyTraderAgent({
  max_copy_usd: Number(process.env.COPY_MAX_USD) || 300,
  copy_delay_ms: Number(process.env.COPY_DELAY_MS) || 2000,
});
copyTrader.setInfrastructure({ db, signalBus, simulation, mcpPool, isSimulation });
manager.register('copy-trader', copyTrader);

const newsEdge = new NewsEdgeAgent({
  sentiment_threshold: Number(process.env.NEWS_SENTIMENT_THRESHOLD) || 0.7,
});
newsEdge.setInfrastructure({ db, signalBus, simulation, mcpPool, isSimulation });
manager.register('news-edge', newsEdge);

const liquidityHunter = new LiquidityHunterAgent({
  min_liquidity_change_pct: Number(process.env.LP_MIN_CHANGE_PCT) || 5,
});
liquidityHunter.setInfrastructure({ db, signalBus, simulation, mcpPool, isSimulation });
manager.register('liquidity-hunter', liquidityHunter);

const portfolioGuard = new PortfolioGuardAgent({
  stop_loss_pct: Number(process.env.GUARD_STOP_LOSS_PCT) || 8,
  rebalance_threshold_pct: Number(process.env.GUARD_REBALANCE_PCT) || 5,
});
portfolioGuard.setInfrastructure({ db, signalBus, simulation, mcpPool, isSimulation });
if (wallet) portfolioGuard.setWallet(wallet);
manager.register('portfolio-guard', portfolioGuard);

logger.info('Orchestrator initialized', {
  agents: manager.listAgents(),
  mode: isSimulation ? 'simulation' : 'real-data',
  wallet: wallet ? walletAddress : 'disabled',
  signalBus: 'connected',
  db: 'initialized',
});

// Periodic health status logging every 30 seconds
setInterval(() => {
  const statuses = manager.getAgentStatuses();
  const errored = Object.entries(statuses).filter(([, s]) => s === 'error');
  if (errored.length > 0) {
    logger.warn('Health check: agents in error state', { errored: errored.map(([n]) => n) });
  } else {
    logger.debug('Health check: all agents healthy', { statuses });
  }
}, 30_000);

// Sync wallet state every 60 seconds
if (wallet) {
  setInterval(() => {
    wallet!.syncState().catch((err) => {
      logger.error('Wallet sync failed', { error: String(err) });
    });
  }, 60_000);
}

manager.startAll().catch((err) => {
  logger.error('Orchestrator failed to start', { error: String(err) });
  process.exit(1);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down...');
  manager.stopAll();
  signalBus.disconnect().catch(() => {});
  if (mcpPool) mcpPool.disconnectAll().catch(() => {});
  db.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down...');
  manager.stopAll();
  signalBus.disconnect().catch(() => {});
  if (mcpPool) mcpPool.disconnectAll().catch(() => {});
  db.close();
  process.exit(0);
});
