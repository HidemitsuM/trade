import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

class MockAgent {
  name: string;
  started = false;
  stopped = false;
  tickCount = 0;
  statusValue: string = 'idle';

  constructor(name: string) { this.name = name; }

  async start() { this.started = true; this.statusValue = 'running'; }
  stop() { this.stopped = true; this.statusValue = 'stopped'; }
  getStatus() { return this.statusValue; }
  publishSignal() { return { id: 'sig-1', source_agent: this.name, signal_type: 'test', data: {}, confidence: 0.5, timestamp: new Date().toISOString() }; }
}

import { AgentManager } from '../src/agent-manager.js';

describe('AgentManager', () => {
  let manager: AgentManager;

  beforeEach(() => {
    manager = new AgentManager();
  });

  afterEach(() => {
    manager.stopAll();
  });

  it('registers and starts an agent', async () => {
    const agent = new MockAgent('test-agent');
    manager.register('test-agent', agent);
    await manager.startAgent('test-agent');
    expect(agent.started).toBe(true);
  });

  it('stops a running agent', async () => {
    const agent = new MockAgent('test-agent');
    manager.register('test-agent', agent);
    await manager.startAgent('test-agent');
    manager.stopAgent('test-agent');
    expect(agent.stopped).toBe(true);
  });

  it('stops all agents', async () => {
    const a1 = new MockAgent('agent-1');
    const a2 = new MockAgent('agent-2');
    manager.register('agent-1', a1);
    manager.register('agent-2', a2);
    await manager.startAll();
    manager.stopAll();
    expect(a1.stopped).toBe(true);
    expect(a2.stopped).toBe(true);
  });

  it('lists registered agents', () => {
    manager.register('agent-1', new MockAgent('agent-1'));
    manager.register('agent-2', new MockAgent('agent-2'));
    const list = manager.listAgents();
    expect(list).toEqual(['agent-1', 'agent-2']);
  });

  it('throws when starting unregistered agent', async () => {
    await expect(manager.startAgent('nonexistent')).rejects.toThrow('not registered');
  });

  it('gets status of all agents', async () => {
    const a1 = new MockAgent('agent-1');
    manager.register('agent-1', a1);
    const statuses = manager.getAgentStatuses();
    expect(statuses['agent-1']).toBe('idle');
  });
});
