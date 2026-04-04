import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseAgent } from '../src/base-agent.js';
import type { Signal, SignalType } from '../src/types.js';
import type { SignalBus } from '../src/signal-bus.js';
import type { Database } from '../src/db.js';

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

function createMockSignalBus(): SignalBus {
  return {
    publish: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
  } as unknown as SignalBus;
}

function createMockDb(): Database {
  return {
    insertSignal: vi.fn(),
    initialize: vi.fn(),
    insertTrade: vi.fn(),
    getTradesByAgent: vi.fn().mockReturnValue([]),
    getAgentPnl: vi.fn().mockReturnValue(0),
    getSignalsByType: vi.fn().mockReturnValue([]),
    upsertAgentState: vi.fn(),
    getAgentState: vi.fn().mockReturnValue(undefined),
    upsertRiskState: vi.fn(),
    getRiskStates: vi.fn().mockReturnValue([]),
    close: vi.fn(),
  } as unknown as Database;
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

  describe('SignalBus integration', () => {
    it('setInfrastructure sets signalBus and db', () => {
      const signalBus = createMockSignalBus();
      const db = createMockDb();
      agent.setInfrastructure(signalBus, db);
      // Verify via publishSignal behavior below
    });

    it('publishSignal calls signalBus.publish() when signalBus is set', () => {
      const signalBus = createMockSignalBus();
      const db = createMockDb();
      agent.setInfrastructure(signalBus, db);

      const signal = agent.publishSignal('price_gap', { pair: 'SOL/USDT' }, 0.9);
      expect(signalBus.publish).toHaveBeenCalledWith(signal);
    });

    it('publishSignal calls db.insertSignal() when db is set', () => {
      const signalBus = createMockSignalBus();
      const db = createMockDb();
      agent.setInfrastructure(signalBus, db);

      const signal = agent.publishSignal('whale_move', { address: '0xabc' }, 0.7);
      expect(db.insertSignal).toHaveBeenCalledWith(signal);
    });

    it('publishSignal does not throw without signalBus', () => {
      expect(() => {
        agent.publishSignal('price_gap', { pair: 'SOL/USDT' }, 0.8);
      }).not.toThrow();
    });

    it('subscribes to signal types on start when signalBus is set', async () => {
      const signalBus = createMockSignalBus();

      class SubscribingAgent extends TestAgent {
        protected getSubscribedSignalTypes(): SignalType[] {
          return ['price_gap', 'whale_move'];
        }
      }

      const subAgent = new SubscribingAgent();
      subAgent.setInfrastructure(signalBus, createMockDb());
      await subAgent.start();
      subAgent.stop();

      expect(signalBus.subscribe).toHaveBeenCalledTimes(2);
      expect(signalBus.subscribe).toHaveBeenCalledWith('price_gap', expect.any(Function));
      expect(signalBus.subscribe).toHaveBeenCalledWith('whale_move', expect.any(Function));
    });
  });
});
