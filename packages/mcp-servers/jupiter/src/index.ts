#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { JupiterClient } from './tools.js';

const client = new JupiterClient();
const server = new McpServer({ name: 'jupiter', version: '0.1.0' });

server.tool(
  'get_quote',
  'Get a swap quote from Jupiter DEX aggregator',
  { input_mint: z.string().describe('Input token mint address'), output_mint: z.string().describe('Output token mint address'), amount: z.number().positive().describe('Amount in smallest token unit') },
  async ({ input_mint, output_mint, amount }) => {
    const quote = await client.getQuote({ inputMint: input_mint, outputMint: output_mint, amount });
    return { content: [{ type: 'text' as const, text: JSON.stringify(quote, null, 2) }] };
  }
);

server.tool(
  'get_routes',
  'Get available swap routes from Jupiter',
  { input_mint: z.string().describe('Input token mint address'), output_mint: z.string().describe('Output token mint address'), amount: z.number().positive().describe('Amount in smallest token unit') },
  async ({ input_mint, output_mint, amount }) => {
    const routes = await client.getRoutes({ inputMint: input_mint, outputMint: output_mint, amount });
    return { content: [{ type: 'text' as const, text: JSON.stringify(routes, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);
