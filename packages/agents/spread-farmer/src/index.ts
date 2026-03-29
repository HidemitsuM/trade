#!/usr/bin/env node
import { SpreadFarmerAgent } from './agent.js';
const agent = new SpreadFarmerAgent({ min_spread_pct: Number(process.env.SPREAD_MIN_PCT) || 2, max_positions: Number(process.env.SPREAD_MAX_POSITIONS) || 10 });
agent.start().catch(console.error);
process.on('SIGTERM', () => agent.stop());
process.on('SIGINT', () => agent.stop());
