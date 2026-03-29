#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { BrowserClient } from './tools.js';

const client = new BrowserClient();
const server = new McpServer({ name: 'browser', version: '0.1.0' });

server.tool(
  'scrape_page',
  'Scrape a web page and return its content',
  {
    url: z.string().url().describe('URL to scrape'),
    timeout_ms: z.number().optional().describe('Timeout in milliseconds, default 30000'),
  },
  async ({ url, timeout_ms }) => {
    const result = await client.scrapePage(url, timeout_ms);
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'check_social',
  'Check a social media page for sentiment and red flags',
  {
    url: z.string().url().describe('Social media URL to check'),
    timeout_ms: z.number().optional().describe('Timeout in milliseconds, default 10000'),
  },
  async ({ url, timeout_ms }) => {
    const result = await client.checkSocial(url, timeout_ms);
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);

process.on('SIGTERM', () => client.close());
process.on('SIGINT', () => client.close());
