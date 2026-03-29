#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { DuneClient } from './tools.js';

const client = new DuneClient(process.env.DUNE_API_KEY || '');
const server = new McpServer({ name: 'dune', version: '0.1.0' });

server.tool(
  'execute_query',
  'Execute a Dune Analytics query by ID and return results',
  {
    query_id: z.number().describe('Dune query ID'),
  },
  async ({ query_id }) => {
    const result = await client.executeQuery(query_id);
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'get_query_results',
  'Get cached results of a previously executed Dune query',
  {
    query_id: z.number().describe('Dune query ID'),
  },
  async ({ query_id }) => {
    const result = await client.getQueryResults(query_id);
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);
