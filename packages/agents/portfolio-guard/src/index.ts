#!/usr/bin/env node
import { PortfolioGuardAgent } from './agent.js';
const agent = new PortfolioGuardAgent({
  stop_loss_pct: Number(process.env.GUARD_STOP_LOSS_PCT) || 8,
  rebalance_threshold_pct: Number(process.env.GUARD_REBALANCE_PCT) || 5,
});
agent.start().catch(console.error);
process.on('SIGTERM', () => agent.stop());
process.on('SIGINT', () => agent.stop());
