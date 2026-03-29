import { describe, it, expect } from 'vitest';
import { PumpSniperStrategy } from '../src/strategy.js';

describe('PumpSniperStrategy', () => {
  it('approves token with good liquidity and no red flags', () => {
    const strategy = new PumpSniperStrategy({ max_position_usd: 200, max_open_positions: 3 });
    const decision = strategy.evaluate({ token: 'PEPE', liquidity_usd: 50000, social_score: 0.8, red_flags: [] });
    expect(decision.should_buy).toBe(true);
  });
  it('rejects token with low liquidity', () => {
    const strategy = new PumpSniperStrategy({ max_position_usd: 200, max_open_positions: 3 });
    const decision = strategy.evaluate({ token: 'SCAM', liquidity_usd: 500, social_score: 0.5, red_flags: [] });
    expect(decision.should_buy).toBe(false);
  });
  it('rejects token with red flags', () => {
    const strategy = new PumpSniperStrategy({ max_position_usd: 200, max_open_positions: 3 });
    const decision = strategy.evaluate({ token: 'RUG', liquidity_usd: 100000, social_score: 0.3, red_flags: ['contract_mint_disabled', 'holder_concentration'] });
    expect(decision.should_buy).toBe(false);
  });
});
