#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { BscClient } from './tools.js';

const rpcUrl = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/';
const client = new BscClient(rpcUrl);
const server = new McpServer({ name: 'bnb-chain', version: '0.1.0' });

server.tool(
  'get_balance',
  'Get BNB balance for an address',
  { address: z.string().describe('BSC wallet address') },
  async ({ address }) => {
    const balance = await client.getBalance(address);
    const bnb = parseInt(balance, 16) / 1e18;
    return { content: [{ type: 'text' as const, text: JSON.stringify({ wei: balance, bnb }, null, 2) }] };
  }
);

server.tool(
  'call_contract',
  'Call a BSC smart contract read method',
  { contract_address: z.string().describe('Contract address'), data: z.string().describe('Encoded function call data') },
  async ({ contract_address, data }) => {
    const result = await client.callContract(contract_address, data);
    return { content: [{ type: 'text' as const, text: JSON.stringify({ result }, null, 2) }] };
  }
);

server.tool(
  'get_transaction_count',
  'Get transaction count (nonce) for an address',
  { address: z.string().describe('BSC wallet address') },
  async ({ address }) => {
    const count = await client.getTransactionCount(address);
    return { content: [{ type: 'text' as const, text: JSON.stringify({ nonce: count }, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);
