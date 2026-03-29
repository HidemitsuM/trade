import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SignalBus } from '../src/signal-bus.js';
import type { Signal } from '../src/types.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

describe('SignalBus', () => {
  let bus: SignalBus;

  beforeEach(() => {
    bus = new SignalBus(REDIS_URL);
  });

  afterEach(async () => {
    await bus.disconnect();
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

    await new Promise((r) => setTimeout(r, 100));
    await bus.publish(signal);
    await new Promise((r) => setTimeout(r, 200));

    expect(received).toHaveLength(1);
    expect(received[0].source_agent).toBe('whale-tracker');
    expect((received[0].data as { wallet: string }).wallet).toBe('test');
  });

  it('allows unsubscribing', async () => {
    const handler = await bus.subscribe('trade_executed', () => {});
    await bus.unsubscribe('trade_executed', handler);
  });
});
