#!/usr/bin/env node
import { logger, Database, SignalBus, SimulationEngine } from '@trade/core';
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

// Initialize infrastructure
const db = new Database(process.env.DB_PATH || './data/trade.db');
db.initialize();

const signalBus = new SignalBus(process.env.REDIS_URL || 'redis://localhost:6379');
const simulation = new SimulationEngine();

const infra = { db, signalBus, simulation };

const manager = new AgentManager();

const arbScanner = new ArbScannerAgent({
  min_profit_usd: Number(process.env.ARB_MIN_PROFIT_USD) || 5,
  chains: (process.env.ARB_CHAINS || 'solana,bsc').split(','),
});
arbScanner.setInfrastructure(infra);
manager.register('arb-scanner', arbScanner);

const pumpSniper = new PumpSniperAgent({
  max_position_usd: Number(process.env.PUMP_MAX_POSITION_USD) || 200,
  max_open_positions: Number(process.env.PUMP_MAX_POSITIONS) || 3,
});
pumpSniper.setInfrastructure(infra);
manager.register('pump-sniper', pumpSniper);

const spreadFarmer = new SpreadFarmerAgent({
  min_spread_pct: Number(process.env.SPREAD_MIN_PCT) || 2,
  max_positions: Number(process.env.SPREAD_MAX_POSITIONS) || 10,
});
spreadFarmer.setInfrastructure(infra);
manager.register('spread-farmer', spreadFarmer);

const whaleTracker = new WhaleTrackerAgent({
  min_whale_usd: Number(process.env.WHALE_MIN_USD) || 10000,
});
whaleTracker.setInfrastructure(infra);
manager.register('whale-tracker', whaleTracker);

const copyTrader = new CopyTraderAgent({
  max_copy_usd: Number(process.env.COPY_MAX_USD) || 300,
  copy_delay_ms: Number(process.env.COPY_DELAY_MS) || 2000,
});
copyTrader.setInfrastructure(infra);
manager.register('copy-trader', copyTrader);

const newsEdge = new NewsEdgeAgent({
  sentiment_threshold: Number(process.env.NEWS_SENTIMENT_THRESHOLD) || 0.7,
});
newsEdge.setInfrastructure(infra);
manager.register('news-edge', newsEdge);

const liquidityHunter = new LiquidityHunterAgent({
  min_liquidity_change_pct: Number(process.env.LP_MIN_CHANGE_PCT) || 5,
});
liquidityHunter.setInfrastructure(infra);
manager.register('liquidity-hunter', liquidityHunter);

const portfolioGuard = new PortfolioGuardAgent({
  stop_loss_pct: Number(process.env.GUARD_STOP_LOSS_PCT) || 8,
  rebalance_threshold_pct: Number(process.env.GUARD_REBALANCE_PCT) || 5,
});
portfolioGuard.setInfrastructure(infra);
manager.register('portfolio-guard', portfolioGuard);

logger.info('Orchestrator initialized', {
  agents: manager.listAgents(),
  signalBus: 'connected',
  db: 'initialized',
});

manager.startAll().catch((err) => {
  logger.error('Orchestrator failed to start', { error: String(err) });
  process.exit(1);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down...');
  manager.stopAll();
  signalBus.disconnect().catch(() => {});
  db.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down...');
  manager.stopAll();
  signalBus.disconnect().catch(() => {});
  db.close();
  process.exit(0);
});
