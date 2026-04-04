import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MCPClientWrapper } from '../src/mcp-client.js';

// Mock the MCP SDK modules
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => {
  const MockClient = vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    callTool: vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ result: 'ok' }) }],
    }),
    listTools: vi.fn().mockResolvedValue({
      tools: [{ name: 'test_tool', description: 'A test tool' }],
    }),
    close: vi.fn().mockResolvedValue(undefined),
  }));
  return { Client: MockClient };
});

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => {
  const MockStdioClientTransport = vi.fn().mockImplementation(() => ({
    close: vi.fn().mockResolvedValue(undefined),
  }));
  return { StdioClientTransport: MockStdioClientTransport };
});

describe('MCPClientWrapper', () => {
  let wrapper: MCPClientWrapper;

  beforeEach(() => {
    wrapper = new MCPClientWrapper({
      command: 'node',
      args: ['server.js'],
      env: { API_KEY: 'test' },
    });
  });

  it('connects without error', async () => {
    await expect(wrapper.connect()).resolves.toBeUndefined();
  });

  it('throws error when calling callTool without connection', async () => {
    await expect(wrapper.callTool('test')).rejects.toThrow('MCP client not connected');
  });

  it('throws error when calling listTools without connection', async () => {
    await expect(wrapper.listTools()).rejects.toThrow('MCP client not connected');
  });

  it('disconnects gracefully when not connected', async () => {
    await expect(wrapper.disconnect()).resolves.toBeUndefined();
  });

  it('disconnects gracefully after connecting', async () => {
    await wrapper.connect();
    await expect(wrapper.disconnect()).resolves.toBeUndefined();
  });
});
