import { describe, it, expect } from 'vitest';
import { SimulationEngine, createSimulationEngine } from '../src/simulation.js';
import type { SimulationConfig } from '../src/types.js';

describe('SimulationEngine', () => {
  const config: SimulationConfig = {
    enabled: true,
    slippage_pct: 0.5,  // 0.5%
    fee_pct: 0.1,       // 0.1%
  };

  describe('fee calculation', () => {
    it('calculates fee as quantity * executed_price * fee_pct / 100', () => {
      const engine = new SimulationEngine(config);
      const result = engine.simulateOrder('buy', 100, 10);

      // Fee should be quantity * executed_price * fee_pct / 100
      const expectedFee = 10 * result.executed_price * 0.1 / 100;
      expect(result.fee).toBeCloseTo(expectedFee, 10);
    });

    it('calculates correct fee for a known scenario with zero slippage config', () => {
      const zeroSlippageConfig: SimulationConfig = {
        enabled: true,
        slippage_pct: 0,
        fee_pct: 0.1,
      };
      const engine = new SimulationEngine(zeroSlippageConfig);
      const result = engine.simulateOrder('buy', 200, 5);

      // With zero slippage, executed_price === price
      expect(result.executed_price).toBe(200);
      // Fee: 5 * 200 * 0.1 / 100 = 1
      expect(result.fee).toBeCloseTo(1, 10);
    });
  });

  describe('slippage', () => {
    it('applies slippage within the specified range', () => {
      const engine = new SimulationEngine(config);
      const price = 100;

      // Run many times to check the range
      for (let i = 0; i < 100; i++) {
        const result = engine.simulateOrder('buy', price, 1);
        const maxSlippage = price * config.slippage_pct / 100;

        expect(result.executed_price).toBeGreaterThanOrEqual(price - maxSlippage);
        expect(result.executed_price).toBeLessThanOrEqual(price + maxSlippage);
        expect(Math.abs(result.slippage_applied)).toBeLessThanOrEqual(maxSlippage + 1e-10);
      }
    });

    it('produces varying slippage across multiple calls', () => {
      const engine = new SimulationEngine(config);
      const prices: number[] = [];

      for (let i = 0; i < 50; i++) {
        const result = engine.simulateOrder('buy', 100, 1);
        prices.push(result.executed_price);
      }

      const uniquePrices = new Set(prices);
      // With random slippage, we should get more than 1 unique value
      expect(uniquePrices.size).toBeGreaterThan(1);
    });
  });

  describe('mockExecuteTrade', () => {
    it('generates a correct TradeLog', () => {
      const engine = new SimulationEngine(config);
      const trade = engine.mockExecuteTrade({
        agent: 'arb-scanner',
        pair: 'SOL/USDT',
        side: 'buy',
        price: 150,
        quantity: 10,
        chain: 'solana',
      });

      expect(trade.agent).toBe('arb-scanner');
      expect(trade.pair).toBe('SOL/USDT');
      expect(trade.side).toBe('buy');
      expect(trade.quantity).toBe(10);
      expect(trade.chain).toBe('solana');
      expect(trade.entry_price).toBeGreaterThan(0);
      expect(trade.exit_price).toBeNull();
      expect(trade.pnl).toBeNull();
      expect(trade.fee).toBeGreaterThan(0);
      expect(trade.id).toBeDefined();
      expect(trade.timestamp).toBeDefined();
    });

    it('marks simulated as true', () => {
      const engine = new SimulationEngine(config);
      const trade = engine.mockExecuteTrade({
        agent: 'test-agent',
        pair: 'ETH/USDT',
        side: 'sell',
        price: 2000,
        quantity: 1,
        chain: 'ethereum',
      });

      expect(trade.simulated).toBe(true);
    });

    it('generates tx_hash with sim_ prefix', () => {
      const engine = new SimulationEngine(config);
      const trade = engine.mockExecuteTrade({
        agent: 'test-agent',
        pair: 'ETH/USDT',
        side: 'buy',
        price: 2000,
        quantity: 1,
        chain: 'ethereum',
      });

      expect(trade.tx_hash).toMatch(/^sim_/);
      // sim_ prefix followed by a UUID (36 chars)
      expect(trade.tx_hash!.length).toBeGreaterThan(5);
    });

    it('generates unique ids and tx_hashes across calls', () => {
      const engine = new SimulationEngine(config);
      const trades = new Set<string>();
      const hashes = new Set<string>();

      for (let i = 0; i < 20; i++) {
        const trade = engine.mockExecuteTrade({
          agent: 'test-agent',
          pair: 'SOL/USDT',
          side: 'buy',
          price: 100,
          quantity: 1,
          chain: 'solana',
        });
        trades.add(trade.id);
        hashes.add(trade.tx_hash!);
      }

      expect(trades.size).toBe(20);
      expect(hashes.size).toBe(20);
    });
  });

  describe('createSimulationEngine factory', () => {
    it('creates a SimulationEngine instance', () => {
      const engine = createSimulationEngine(config);
      expect(engine).toBeInstanceOf(SimulationEngine);
    });

    it('creates an engine that works correctly', () => {
      const engine = createSimulationEngine(config);
      const result = engine.simulateOrder('buy', 100, 1);
      expect(result.executed_price).toBeGreaterThan(0);
      expect(result.fee).toBeGreaterThan(0);
    });
  });
});
