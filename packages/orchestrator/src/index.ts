#!/usr/bin/env node
import { logger } from '@trade/core';
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

const manager = new AgentManager();

manager.register('arb-scanner', new ArbScannerAgent({
  min_profit_usd: Number(process.env.ARB_MIN_PROFIT_USD) || 5,
  chains: (process.env.ARB_CHAINS || 'solana,bsc').split(','),
}));

manager.register('pump-sniper', new PumpSniperAgent({
  max_position_usd: Number(process.env.PUMP_MAX_POSITION_USD) || 200,
  max_open_positions: Number(process.env.PUMP_MAX_POSITIONS) || 3,
}));

manager.register('spread-farmer', new SpreadFarmerAgent({
  min_spread_pct: Number(process.env.SPREAD_MIN_PCT) || 2,
  max_positions: Number(process.env.SPREAD_MAX_POSITIONS) || 10,
}));

manager.register('whale-tracker', new WhaleTrackerAgent({
  min_whale_usd: Number(process.env.WHALE_MIN_USD) || 10000,
}));

manager.register('copy-trader', new CopyTraderAgent({
  max_copy_usd: Number(process.env.COPY_MAX_USD) || 300,
  copy_delay_ms: Number(process.env.COPY_DELAY_MS) || 2000,
}));

manager.register('news-edge', new NewsEdgeAgent({
  sentiment_threshold: Number(process.env.NEWS_SENTIMENT_THRESHOLD) || 0.7,
}));

manager.register('liquidity-hunter', new LiquidityHunterAgent({
  min_liquidity_change_pct: Number(process.env.LP_MIN_CHANGE_PCT) || 5,
}));

manager.register('portfolio-guard', new PortfolioGuardAgent({
  stop_loss_pct: Number(process.env.GUARD_STOP_LOSS_PCT) || 8,
  rebalance_threshold_pct: Number(process.env.GUARD_REBALANCE_PCT) || 5,
}));

logger.info('Orchestrator initialized', { agents: manager.listAgents() });

manager.startAll().catch((err) => {
  logger.error('Orchestrator failed to start', { error: String(err) });
  process.exit(1);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down...');
  manager.stopAll();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down...');
  manager.stopAll();
  process.exit(0);
});
