import { logger } from '@trade/core';
import type { AgentStatus } from '@trade/core';

export interface AgentLike {
  start(): Promise<void>;
  stop(): void;
  getStatus(): AgentStatus;
  name: string;
}

export class AgentManager {
  private agents: Map<string, AgentLike> = new Map();

  register(name: string, agent: AgentLike): void {
    this.agents.set(name, agent);
    logger.info(`Registered agent: ${name}`);
  }

  async startAgent(name: string): Promise<void> {
    const agent = this.agents.get(name);
    if (!agent) throw new Error(`Agent "${name}" is not registered`);
    await agent.start();
    logger.info(`Started agent: ${name}`);
  }

  stopAgent(name: string): void {
    const agent = this.agents.get(name);
    if (!agent) throw new Error(`Agent "${name}" is not registered`);
    agent.stop();
    logger.info(`Stopped agent: ${name}`);
  }

  async startAll(): Promise<void> {
    for (const [name] of this.agents) {
      await this.startAgent(name);
    }
    logger.info('All agents started');
  }

  stopAll(): void {
    for (const [name] of this.agents) {
      try { this.stopAgent(name); } catch { /* already stopped */ }
    }
    logger.info('All agents stopped');
  }

  listAgents(): string[] {
    return Array.from(this.agents.keys());
  }

  getAgentStatuses(): Record<string, AgentStatus> {
    const statuses: Record<string, AgentStatus> = {};
    for (const [name, agent] of this.agents) {
      statuses[name] = agent.getStatus();
    }
    return statuses;
  }
}
