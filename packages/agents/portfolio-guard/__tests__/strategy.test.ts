import { describe, it, expect } from 'vitest';
import { PortfolioGuardStrategy } from '../src/strategy.js';

describe('PortfolioGuardStrategy', () => {
  it('triggers stop-loss when position drops below threshold', () => {
    const strategy = new PortfolioGuardStrategy({ stop_loss_pct: 8, rebalance_threshold_pct: 5 });
    const action = strategy.evaluate({
      positions: [{ token: 'SOL', entry_price: 150, current_price: 135, allocation_pct: 25 }],
      total_value_usd: 5000,
      max_exposure_usd: 5000,
    });
    expect(action.stop_loss_triggered).toBe(true);
    expect(action.tokens_to_sell).toContain('SOL');
  });
  it('does nothing when portfolio is healthy', () => {
    const strategy = new PortfolioGuardStrategy({ stop_loss_pct: 8, rebalance_threshold_pct: 5 });
    const action = strategy.evaluate({
      positions: [{ token: 'SOL', entry_price: 150, current_price: 148, allocation_pct: 20 }],
      total_value_usd: 3000,
      max_exposure_usd: 5000,
    });
    expect(action.stop_loss_triggered).toBe(false);
    expect(action.tokens_to_sell).toHaveLength(0);
  });
  it('flags over-concentration', () => {
    const strategy = new PortfolioGuardStrategy({ stop_loss_pct: 8, rebalance_threshold_pct: 5 });
    const action = strategy.evaluate({
      positions: [
        { token: 'SOL', entry_price: 150, current_price: 155, allocation_pct: 60 },
        { token: 'ETH', entry_price: 3000, current_price: 3100, allocation_pct: 40 },
      ],
      total_value_usd: 5000,
      max_exposure_usd: 5000,
    });
    expect(action.rebalance_needed).toBe(true);
    expect(action.tokens_to_sell).toContain('SOL');
  });
});
