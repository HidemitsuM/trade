#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { CoinGeckoClient } from './tools.js';

const client = new CoinGeckoClient(process.env.COINGECKO_API_KEY || '');
const server = new McpServer({ name: 'coingecko', version: '0.1.0' });

server.tool(
  'get_price',
  'Get current price for a cryptocurrency',
  {
    coin_id: z.string().describe('CoinGecko coin ID, e.g. "solana", "ethereum"'),
    vs_currency: z.string().optional().describe('Currency, default "usd"'),
  },
  async ({ coin_id, vs_currency }) => {
    const price = await client.getPrice(coin_id, vs_currency);
    return { content: [{ type: 'text' as const, text: JSON.stringify({ coin_id, price }, null, 2) }] };
  }
);

server.tool(
  'get_trending',
  'Get currently trending cryptocurrencies',
  {},
  async () => {
    const trending = await client.getTrending();
    return { content: [{ type: 'text' as const, text: JSON.stringify(trending, null, 2) }] };
  }
);

server.tool(
  'get_token_info',
  'Get detailed information for a cryptocurrency',
  { coin_id: z.string().describe('CoinGecko coin ID') },
  async ({ coin_id }) => {
    const info = await client.getTokenInfo(coin_id);
    return { content: [{ type: 'text' as const, text: JSON.stringify(info, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);
