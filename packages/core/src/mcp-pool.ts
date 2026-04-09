import { MCPClientWrapper, type MCPServerConfig } from './mcp-client.js';
import { logger } from './logger.js';

export class MCPConnectionPool {
  private connections: Map<string, MCPClientWrapper> = new Map();
  private configs: Map<string, MCPServerConfig> = new Map();

  register(name: string, config: MCPServerConfig): void {
    this.configs.set(name, config);
    logger.debug(`MCP server registered: ${name}`);
  }

  async callTool(serverName: string, toolName: string, args: Record<string, unknown> = {}): Promise<unknown> {
    let client = this.connections.get(serverName);
    if (!client) {
      const config = this.configs.get(serverName);
      if (!config) throw new Error(`MCP server "${serverName}" not registered`);
      client = new MCPClientWrapper(config);
      await client.connect();
      this.connections.set(serverName, client);
      logger.info(`MCP connection established: ${serverName}`);
    }
    return client.callTool(toolName, args);
  }

  async disconnectAll(): Promise<void> {
    for (const [name, client] of this.connections) {
      try {
        await client.disconnect();
      } catch {
        // ignore disconnect errors
      }
      logger.info(`MCP connection closed: ${name}`);
    }
    this.connections.clear();
  }
}
