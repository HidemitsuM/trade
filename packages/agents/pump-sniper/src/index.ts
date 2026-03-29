#!/usr/bin/env node
import { PumpSniperAgent } from './agent.js';
const agent = new PumpSniperAgent({ max_position_usd: Number(process.env.PUMP_MAX_POSITION_USD) || 200, max_open_positions: Number(process.env.PUMP_MAX_POSITIONS) || 3 });
agent.start().catch(console.error);
process.on('SIGTERM', () => agent.stop());
process.on('SIGINT', () => agent.stop());
