import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseAgent } from '../src/base-agent.js';
import type { Signal } from '../src/types.js';

class TestAgent extends BaseAgent {
  tickCount = 0;
  signalsReceived: Signal[] = [];

  constructor() {
    super('test-agent', { interval_ms: 100 });
  }

  protected async tick(): Promise<void> {
    this.tickCount++;
  }

  protected async onSignal(signal: Signal): Promise<void> {
    this.signalsReceived.push(signal);
  }
}

describe('BaseAgent', () => {
  let agent: TestAgent;

  beforeEach(() => { agent = new TestAgent(); });
  afterEach(() => { agent.stop(); });

  it('starts and runs tick on interval', async () => {
    await agent.start();
    await new Promise((r) => setTimeout(r, 350));
    expect(agent.tickCount).toBeGreaterThanOrEqual(3);
  });

  it('stops running when stopped', async () => {
    await agent.start();
    await new Promise((r) => setTimeout(r, 250));
    agent.stop();
    const count = agent.tickCount;
    await new Promise((r) => setTimeout(r, 250));
    expect(agent.tickCount).toBe(count);
  });

  it('has running state', async () => {
    expect(agent.getStatus()).toBe('idle');
    await agent.start();
    expect(agent.getStatus()).toBe('running');
    agent.stop();
    expect(agent.getStatus()).toBe('stopped');
  });

  it('generates unique signal IDs', async () => {
    const s1 = agent.publishSignal('price_gap', { pair: 'SOL/USDT' }, 0.8);
    const s2 = agent.publishSignal('price_gap', { pair: 'ETH/USDT' }, 0.7);
    expect(s1.id).not.toBe(s2.id);
    expect(s1.source_agent).toBe('test-agent');
    expect(s1.signal_type).toBe('price_gap');
  });
});
