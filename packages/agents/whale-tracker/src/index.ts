#!/usr/bin/env node
import { WhaleTrackerAgent } from './agent.js';
const agent = new WhaleTrackerAgent({ min_whale_usd: Number(process.env.WHALE_MIN_USD) || 10000 });
agent.start().catch(console.error);
process.on('SIGTERM', () => agent.stop());
process.on('SIGINT', () => agent.stop());
