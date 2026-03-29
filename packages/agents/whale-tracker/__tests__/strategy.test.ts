import { describe, it, expect } from 'vitest';
import { WhaleTrackerStrategy } from '../src/strategy.js';

describe('WhaleTrackerStrategy', () => {
  it('flags whale transaction above threshold', () => {
    const strategy = new WhaleTrackerStrategy({ min_whale_usd: 10000 });
    const alert = strategy.analyze({ wallet: '0xwhale123', amount_usd: 50000, token: 'SOL', action: 'buy' });
    expect(alert).not.toBeNull();
    expect(alert!.amount_usd).toBe(50000);
  });
  it('ignores small transaction', () => {
    const strategy = new WhaleTrackerStrategy({ min_whale_usd: 10000 });
    const alert = strategy.analyze({ wallet: '0xsmall', amount_usd: 500, token: 'SOL', action: 'sell' });
    expect(alert).toBeNull();
  });
});
