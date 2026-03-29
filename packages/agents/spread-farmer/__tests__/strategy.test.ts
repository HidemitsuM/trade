import { describe, it, expect } from 'vitest';
import { SpreadFarmerStrategy } from '../src/strategy.js';

describe('SpreadFarmerStrategy', () => {
  it('identifies profitable spread', () => {
    const strategy = new SpreadFarmerStrategy({ min_spread_pct: 2, max_positions: 10 });
    const decision = strategy.evaluate({ market: 'Will BTC hit 100k?', best_bid: 0.45, best_ask: 0.55, quantity: 100 });
    expect(decision.should_trade).toBe(true);
    expect(decision.spread_pct).toBeCloseTo(10, 0);
  });
  it('ignores tight spread', () => {
    const strategy = new SpreadFarmerStrategy({ min_spread_pct: 2, max_positions: 10 });
    const decision = strategy.evaluate({ market: 'ETH above 5k?', best_bid: 0.49, best_ask: 0.51, quantity: 100 });
    expect(decision.should_trade).toBe(false);
  });
});
