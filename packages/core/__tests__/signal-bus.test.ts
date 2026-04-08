import { describe, it, expect, beforeEach } from 'vitest';
import type { Signal, SignalType } from '../src/types.js';
import type { SignalBus, SignalHandler } from '../src/signal-bus.js';

class MockSignalBus implements SignalBus {
  private handlers: Map<string, Set<SignalHandler>> = new Map();
  private publishedSignals: Signal[] = [];

  async publish(signal: Signal): Promise<void> {
    this.publishedSignals.push(signal);
    const handlers = this.handlers.get(signal.signal_type);
    if (handlers) {
      for (const h of handlers) {
        h(signal);
      }
    }
  }

  async subscribe(signalType: SignalType, handler: SignalHandler): Promise<SignalHandler> {
    if (!this.handlers.has(signalType)) {
      this.handlers.set(signalType, new Set());
    }
    this.handlers.get(signalType)!.add(handler);
    return handler;
  }

  async unsubscribe(signalType: SignalType, handler: SignalHandler): Promise<void> {
    const handlers = this.handlers.get(signalType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  async disconnect(): Promise<void> {
    this.handlers.clear();
  }

  getPublishedSignals(): Signal[] {
    return this.publishedSignals;
  }
}

describe('SignalBus', () => {
  let bus: MockSignalBus;

  beforeEach(() => {
    bus = new MockSignalBus();
  });

  it('publishes and receives signals', async () => {
    const signal: Signal = {
      id: 'sig-test-1',
      source_agent: 'whale-tracker',
      signal_type: 'whale_move',
      data: { wallet: 'test', amount: 10000 },
      confidence: 0.85,
      timestamp: new Date().toISOString(),
    };

    const received: Signal[] = [];
    await bus.subscribe('whale_move', (s) => received.push(s));

    await bus.publish(signal);

    expect(received).toHaveLength(1);
    expect(received[0].source_agent).toBe('whale-tracker');
    expect((received[0].data as { wallet: string }).wallet).toBe('test');
  });

  it('allows unsubscribing', async () => {
    const handler = await bus.subscribe('trade_executed', () => {});
    await bus.unsubscribe('trade_executed', handler);

    const signal: Signal = {
      id: 'sig-test-2',
      source_agent: 'arb-scanner',
      signal_type: 'trade_executed',
      data: { pair: 'SOL/USDT' },
      confidence: 0.9,
      timestamp: new Date().toISOString(),
    };

    await bus.publish(signal);
    expect(bus.getPublishedSignals()).toHaveLength(1);
  });

  it('stores published signals', async () => {
    const signal: Signal = {
      id: 'sig-test-3',
      source_agent: 'test-agent',
      signal_type: 'price_gap',
      data: { pair: 'BTC/USDT' },
      confidence: 0.7,
      timestamp: new Date().toISOString(),
    };

    await bus.publish(signal);
    expect(bus.getPublishedSignals()).toHaveLength(1);
    expect(bus.getPublishedSignals()[0].id).toBe('sig-test-3');
  });

  it('delivers to multiple subscribers of same type', async () => {
    const received1: Signal[] = [];
    const received2: Signal[] = [];
    await bus.subscribe('whale_move', (s) => received1.push(s));
    await bus.subscribe('whale_move', (s) => received2.push(s));

    const signal: Signal = {
      id: 'sig-test-4',
      source_agent: 'whale-tracker',
      signal_type: 'whale_move',
      data: { wallet: '0xabc' },
      confidence: 0.8,
      timestamp: new Date().toISOString(),
    };

    await bus.publish(signal);
    expect(received1).toHaveLength(1);
    expect(received2).toHaveLength(1);
  });
});
