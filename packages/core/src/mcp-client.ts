import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export class MCPClientWrapper {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;

  constructor(private config: MCPServerConfig) {}

  async connect(): Promise<void> {
    this.transport = new StdioClientTransport({
      command: this.config.command,
      args: this.config.args,
      env: this.config.env,
    });
    this.client = new Client({ name: 'trade-agent', version: '1.0.0' });
    await this.client.connect(this.transport);
  }

  async callTool(toolName: string, args: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.client) throw new Error('MCP client not connected');
    const result = await this.client.callTool({ name: toolName, arguments: args });
    // Extract text content from result
    if (result.content && Array.isArray(result.content)) {
      const textContent = result.content.find((c: any) => c.type === 'text');
      if (textContent) {
        try { return JSON.parse(textContent.text); } catch { return textContent.text; }
      }
    }
    return result;
  }

  async listTools(): Promise<unknown[]> {
    if (!this.client) throw new Error('MCP client not connected');
    const result = await this.client.listTools();
    return result.tools;
  }

  async disconnect(): Promise<void> {
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
    this.client = null;
  }
}
