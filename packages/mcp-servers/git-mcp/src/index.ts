#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { GitHubClient } from './tools.js';

const client = new GitHubClient(process.env.GITHUB_TOKEN || '');
const server = new McpServer({ name: 'git-mcp', version: '0.1.0' });

server.tool(
  'search_repos',
  'Search GitHub repositories',
  { query: z.string().describe('Search query') },
  async ({ query }) => {
    const repos = await client.searchRepos(query);
    return { content: [{ type: 'text' as const, text: JSON.stringify(repos, null, 2) }] };
  }
);

server.tool(
  'get_file_content',
  'Read file content from a GitHub repository',
  {
    repo: z.string().describe('Repository in "owner/repo" format'),
    path: z.string().describe('File path within the repository'),
  },
  async ({ repo, path }) => {
    const content = await client.getFileContent(repo, path);
    return { content: [{ type: 'text' as const, text: content }] };
  }
);

server.tool(
  'get_repo_info',
  'Get metadata for a GitHub repository',
  { repo: z.string().describe('Repository in "owner/repo" format') },
  async ({ repo }) => {
    const info = await client.getRepoInfo(repo);
    return { content: [{ type: 'text' as const, text: JSON.stringify(info, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);
