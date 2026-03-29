import { describe, it, expect } from 'vitest';
import { LiquidityHunterStrategy } from '../src/strategy.js';

describe('LiquidityHunterStrategy', () => {
  it('flags significant liquidity increase', () => {
    const strategy = new LiquidityHunterStrategy({ min_liquidity_change_pct: 5 });
    const alert = strategy.analyze({ token: 'SOL', previous_liquidity: 100000, current_liquidity: 120000 });
    expect(alert).not.toBeNull();
    expect(alert!.change_pct).toBeCloseTo(20, 0);
  });
  it('ignores small liquidity changes', () => {
    const strategy = new LiquidityHunterStrategy({ min_liquidity_change_pct: 5 });
    const alert = strategy.analyze({ token: 'SOL', previous_liquidity: 100000, current_liquidity: 102000 });
    expect(alert).toBeNull();
  });
});
