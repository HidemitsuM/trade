#!/usr/bin/env node
import { LiquidityHunterAgent } from './agent.js';
const agent = new LiquidityHunterAgent({ min_liquidity_change_pct: Number(process.env.LP_MIN_CHANGE_PCT) || 5 });
agent.start().catch(console.error);
process.on('SIGTERM', () => agent.stop());
process.on('SIGINT', () => agent.stop());
