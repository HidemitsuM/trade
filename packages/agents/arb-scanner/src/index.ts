#!/usr/bin/env node
import { ArbScannerAgent } from './agent.js';
const agent = new ArbScannerAgent({
  min_profit_usd: Number(process.env.ARB_MIN_PROFIT_USD) || 5,
  chains: (process.env.ARB_CHAINS || 'solana,bsc').split(','),
});
agent.start().catch(console.error);
process.on('SIGTERM', () => agent.stop());
process.on('SIGINT', () => agent.stop());
