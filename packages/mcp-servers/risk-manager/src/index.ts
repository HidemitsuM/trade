#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { RiskManager } from './tools.js';
import type { RiskConfig } from '@trade/core';

const config: RiskConfig = {
  max_total_exposure_usd: Number(process.env.MAX_TOTAL_EXPOSURE_USD) || 5000,
  max_single_trade_usd: Number(process.env.MAX_SINGLE_TRADE_USD) || 500,
  max_drawdown_pct: Number(process.env.MAX_DRAWDOWN_PCT) || 10,
  circuit_breaker_loss_usd: Number(process.env.CIRCUIT_BREAKER_LOSS_USD) || 200,
  daily_loss_limit_usd: Number(process.env.DAILY_LOSS_LIMIT_USD) || 300,
};

const rm = new RiskManager(config);

const server = new McpServer({
  name: 'risk-manager',
  version: '0.1.0',
});

server.tool(
  'check_trade',
  'Check if a proposed trade passes risk limits',
  {
    agent: z.string().describe('Agent proposing the trade'),
    amount_usd: z.number().positive().describe('Trade amount in USD'),
    current_exposure: z.number().min(0).describe('Current total exposure in USD'),
  },
  async ({ agent, amount_usd, current_exposure }) => {
    const result = rm.checkTrade({ agent, amount_usd, current_exposure });
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(result, null, 2),
      }],
    };
  }
);

server.tool(
  'circuit_breaker_status',
  'Check if the circuit breaker is active',
  {},
  async () => {
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          active: rm.isCircuitBreakerActive(),
          daily_pnl: rm.getDailyPnl(),
          drawdown_pct: rm.getDrawdownPct(),
          drawdown_breached: rm.isDrawdownBreached(),
        }, null, 2),
      }],
    };
  }
);

server.tool(
  'record_trade_result',
  'Record a completed trade result for risk tracking',
  {
    pnl: z.number().describe('Profit/loss amount in USD'),
  },
  async ({ pnl }) => {
    rm.recordTrade({ pnl });
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          recorded: true,
          daily_pnl: rm.getDailyPnl(),
          circuit_breaker: rm.isCircuitBreakerActive(),
        }, null, 2),
      }],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
