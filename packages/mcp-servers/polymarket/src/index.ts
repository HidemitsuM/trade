#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { PolymarketClient } from './tools.js';

const client = new PolymarketClient(process.env.POLYMARKET_API_KEY || '', process.env.POLYMARKET_PRIVATE_KEY || '');
const server = new McpServer({ name: 'polymarket', version: '0.1.0' });

server.tool(
  'get_markets',
  'Get active prediction markets from Polymarket',
  {},
  async () => {
    const markets = await client.getMarkets();
    return { content: [{ type: 'text' as const, text: JSON.stringify(markets, null, 2) }] };
  }
);

server.tool(
  'get_orderbook',
  'Get the orderbook for a Polymarket token',
  { token_id: z.string().describe('Polymarket token ID') },
  async ({ token_id }) => {
    const book = await client.getOrderbook(token_id);
    return { content: [{ type: 'text' as const, text: JSON.stringify(book, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);
