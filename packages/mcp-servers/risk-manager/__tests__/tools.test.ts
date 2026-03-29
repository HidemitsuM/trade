import { describe, it, expect } from 'vitest';
import { RiskManager } from '../src/tools.js';

describe('RiskManager', () => {
  const config = {
    max_total_exposure_usd: 5000,
    max_single_trade_usd: 500,
    max_drawdown_pct: 10,
    circuit_breaker_loss_usd: 200,
    daily_loss_limit_usd: 300,
  };

  it('allows trade within limits', () => {
    const rm = new RiskManager(config);
    const result = rm.checkTrade({ agent: 'arb-scanner', amount_usd: 200, current_exposure: 1000 });
    expect(result.approved).toBe(true);
  });

  it('rejects trade exceeding single trade limit', () => {
    const rm = new RiskManager(config);
    const result = rm.checkTrade({ agent: 'arb-scanner', amount_usd: 600, current_exposure: 1000 });
    expect(result.approved).toBe(false);
    expect(result.reason).toContain('single trade');
  });

  it('rejects trade exceeding total exposure', () => {
    const rm = new RiskManager(config);
    const result = rm.checkTrade({ agent: 'arb-scanner', amount_usd: 200, current_exposure: 4900 });
    expect(result.approved).toBe(false);
    expect(result.reason?.toLowerCase()).toContain('total exposure');
  });

  it('triggers circuit breaker on daily loss', () => {
    const rm = new RiskManager(config);
    rm.recordTrade({ pnl: -150 });
    rm.recordTrade({ pnl: -100 });
    const result = rm.checkTrade({ agent: 'arb-scanner', amount_usd: 100, current_exposure: 1000 });
    expect(result.approved).toBe(false);
    expect(result.circuit_breaker).toBe(true);
  });

  it('calculates current drawdown from peak', () => {
    const rm = new RiskManager(config);
    rm.setPeakBalance(10000);
    rm.setCurrentBalance(9200);
    const dd = rm.getDrawdownPct();
    expect(dd).toBe(8);
  });

  it('detects drawdown breach', () => {
    const rm = new RiskManager(config);
    rm.setPeakBalance(10000);
    rm.setCurrentBalance(8500);
    expect(rm.isDrawdownBreached()).toBe(true);
  });

  it('resets daily state', () => {
    const rm = new RiskManager(config);
    rm.recordTrade({ pnl: -250 });
    expect(rm.isCircuitBreakerActive()).toBe(true);
    rm.resetDaily();
    expect(rm.isCircuitBreakerActive()).toBe(false);
    expect(rm.getDailyPnl()).toBe(0);
  });
});
