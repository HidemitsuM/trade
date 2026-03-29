#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { OneInchClient } from './tools.js';

const chainId = Number(process.env.CHAIN_ID) || 56;
const client = new OneInchClient(process.env.ONEINCH_API_KEY || '', chainId);
const server = new McpServer({ name: '1inch', version: '0.1.0' });

server.tool(
  'get_quote',
  'Get a swap quote from 1inch DEX aggregator',
  { from_token: z.string().describe('Source token address'), to_token: z.string().describe('Destination token address'), amount: z.string().describe('Amount in wei') },
  async ({ from_token, to_token, amount }) => {
    const quote = await client.getQuote(from_token, to_token, amount);
    return { content: [{ type: 'text' as const, text: JSON.stringify(quote, null, 2) }] };
  }
);

server.tool(
  'get_spender',
  'Get the 1inch spender address for token approval',
  {},
  async () => {
    const spender = await client.getSpender();
    return { content: [{ type: 'text' as const, text: JSON.stringify({ spender }, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);
