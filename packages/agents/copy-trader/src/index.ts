#!/usr/bin/env node
import { CopyTraderAgent } from './agent.js';
const agent = new CopyTraderAgent({ max_copy_usd: Number(process.env.COPY_MAX_USD) || 300, copy_delay_ms: Number(process.env.COPY_DELAY_MS) || 2000 });
agent.start().catch(console.error);
process.on('SIGTERM', () => agent.stop());
process.on('SIGINT', () => agent.stop());
