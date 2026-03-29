import { describe, it, expect } from 'vitest';
import { CopyTraderStrategy } from '../src/strategy.js';

describe('CopyTraderStrategy', () => {
  it('decides to copy whale buy signal', () => {
    const strategy = new CopyTraderStrategy({ max_copy_usd: 300, copy_delay_ms: 2000 });
    const decision = strategy.evaluate({ whale_wallet: '0xwhale', action: 'buy', token: 'SOL', amount_usd: 50000 });
    expect(decision.should_copy).toBe(true);
    expect(decision.copy_amount_usd).toBeLessThanOrEqual(300);
  });
  it('ignores sell signals', () => {
    const strategy = new CopyTraderStrategy({ max_copy_usd: 300, copy_delay_ms: 2000 });
    const decision = strategy.evaluate({ whale_wallet: '0xwhale', action: 'sell', token: 'SOL', amount_usd: 50000 });
    expect(decision.should_copy).toBe(false);
  });
});
