#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { HeliusClient } from './tools.js';

const rpcUrl = process.env.HELIUS_RPC_URL || 'https://mainnet.helius-rpc.com?api-key=';
const client = new HeliusClient(rpcUrl);

const server = new McpServer({ name: 'helius', version: '0.1.0' });

server.tool(
  'get_transaction',
  'Get Solana transaction details by signature',
  {
    signature: z.string().describe('Transaction signature'),
  },
  async ({ signature }) => {
    const tx = await client.getTransaction(signature);
    return { content: [{ type: 'text' as const, text: JSON.stringify(tx, null, 2) }] };
  }
);

server.tool(
  'get_token_info',
  'Get Solana token metadata by mint address',
  {
    mint: z.string().describe('Token mint address'),
  },
  async ({ mint }) => {
    const info = await client.getTokenInfo(mint);
    return { content: [{ type: 'text' as const, text: JSON.stringify(info, null, 2) }] };
  }
);

server.tool(
  'get_account_balance',
  'Get SOL balance for a wallet address',
  {
    address: z.string().describe('Wallet address'),
  },
  async ({ address }) => {
    const balance = await client.getAccountBalance(address);
    return { content: [{ type: 'text' as const, text: JSON.stringify(balance, null, 2) }] };
  }
);

server.tool(
  'get_signatures_for_address',
  'Get recent transaction signatures for a Solana address',
  {
    address: z.string().describe('Wallet address to query'),
    limit: z.number().optional().default(10).describe('Maximum signatures to return'),
  },
  async ({ address, limit }) => {
    const sigs = await client.getSignaturesForAddress(address, limit);
    return { content: [{ type: 'text' as const, text: JSON.stringify(sigs, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);
