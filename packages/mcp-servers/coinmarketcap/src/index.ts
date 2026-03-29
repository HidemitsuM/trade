#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { CoinMarketCapClient } from './tools.js';

const client = new CoinMarketCapClient(process.env.CMC_API_KEY || '');
const server = new McpServer({ name: 'coinmarketcap', version: '0.1.0' });

server.tool(
  'get_price',
  'Get latest cryptocurrency prices from CoinMarketCap',
  {
    symbols: z.array(z.string()).describe('Array of ticker symbols, e.g. ["SOL", "ETH", "BTC"]'),
  },
  async ({ symbols }) => {
    const quotes = await client.getLatestQuotes(symbols);
    return { content: [{ type: 'text' as const, text: JSON.stringify(quotes, null, 2) }] };
  }
);

server.tool(
  'get_fear_greed',
  'Get the current Crypto Fear & Greed Index',
  {},
  async () => {
    const fg = await client.getFearGreed();
    return { content: [{ type: 'text' as const, text: JSON.stringify(fg, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);
