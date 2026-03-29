#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { PhantomClient } from './tools.js';

const rpcUrl = process.env.HELIUS_RPC_URL || '';
const privateKey = process.env.PHANTOM_PRIVATE_KEY || '';
const client = new PhantomClient(rpcUrl, privateKey);
const server = new McpServer({ name: 'phantom', version: '0.1.0' });

server.tool(
  'get_balance',
  'Get SOL balance for a wallet address',
  { address: z.string().describe('Wallet address') },
  async ({ address }) => {
    const balance = await client.getBalance(address);
    return { content: [{ type: 'text' as const, text: JSON.stringify({ lamports: balance, sol: balance / 1e9 }, null, 2) }] };
  }
);

server.tool(
  'send_transaction',
  'Send a signed Solana transaction',
  { serialized_tx: z.string().describe('Base64-encoded serialized transaction') },
  async ({ serialized_tx }) => {
    const signature = await client.sendTransaction(serialized_tx);
    return { content: [{ type: 'text' as const, text: JSON.stringify({ signature }, null, 2) }] };
  }
);

server.tool(
  'get_token_accounts',
  'Get SPL token accounts for a wallet',
  { address: z.string().describe('Wallet address') },
  async ({ address }) => {
    const accounts = await client.getTokenAccounts(address);
    return { content: [{ type: 'text' as const, text: JSON.stringify(accounts, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);
