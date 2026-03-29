import { describe, it, expect } from 'vitest';
import { ArbStrategy } from '../src/strategy.js';

describe('ArbStrategy', () => {
  it('detects price gap above threshold', () => {
    const strategy = new ArbStrategy({ min_profit_usd: 5, chains: ['solana', 'bsc'] });
    const opportunity = strategy.analyze({ pair: 'SOL/USDT', buyPrice: 150.0, sellPrice: 151.2, quantity: 10 });
    expect(opportunity).not.toBeNull();
    expect(opportunity!.profit).toBeCloseTo(12);
  });
  it('ignores price gap below threshold', () => {
    const strategy = new ArbStrategy({ min_profit_usd: 5, chains: ['solana'] });
    const opportunity = strategy.analyze({ pair: 'SOL/USDT', buyPrice: 150.0, sellPrice: 150.3, quantity: 10 });
    expect(opportunity).toBeNull();
  });
  it('returns null for negative gap', () => {
    const strategy = new ArbStrategy({ min_profit_usd: 5, chains: ['solana'] });
    const opportunity = strategy.analyze({ pair: 'SOL/USDT', buyPrice: 151.0, sellPrice: 150.0, quantity: 10 });
    expect(opportunity).toBeNull();
  });
});
