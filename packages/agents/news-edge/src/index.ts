#!/usr/bin/env node
import { NewsEdgeAgent } from './agent.js';
const agent = new NewsEdgeAgent({ sentiment_threshold: Number(process.env.NEWS_SENTIMENT_THRESHOLD) || 0.7 });
agent.start().catch(console.error);
process.on('SIGTERM', () => agent.stop());
process.on('SIGINT', () => agent.stop());
