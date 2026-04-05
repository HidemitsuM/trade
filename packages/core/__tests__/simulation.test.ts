import { describe, it, expect } from 'vitest';
import { SimulationEngine } from '../src/simulation.js';

describe('SimulationEngine', () => {
  const engine = new SimulationEngine();

  describe('generateArbPrices', () => {
    it('returns array of price data with correct structure', () => {
      const prices = engine.generateArbPrices();
      expect(prices.length).toBeGreaterThan(0);
      for (const p of prices) {
        expect(p).toHaveProperty('pair');
        expect(p).toHaveProperty('buyPrice');
        expect(p).toHaveProperty('sellPrice');
        expect(p).toHaveProperty('quantity');
        expect(p.buyPrice).toBeGreaterThan(0);
      }
    });
  });

  describe('generateWhaleTx', () => {
    it('returns whale transaction data', () => {
      const tx = engine.generateWhaleTx();
      expect(tx).toHaveProperty('wallet');
      expect(tx).toHaveProperty('amount_usd');
      expect(tx).toHaveProperty('token');
      expect(tx).toHaveProperty('action');
      expect(['buy', 'sell']).toContain(tx.action);
    });
  });

  describe('generateLiquidityData', () => {
    it('returns liquidity data with previous and current', () => {
      const data = engine.generateLiquidityData();
      expect(data).toHaveProperty('token');
      expect(data).toHaveProperty('previous_liquidity');
      expect(data).toHaveProperty('current_liquidity');
      expect(data.previous_liquidity).toBeGreaterThan(0);
    });
  });

  describe('generateSentimentData', () => {
    it('returns sentiment data in valid range', () => {
      const data = engine.generateSentimentData();
      expect(data.sentiment_score).toBeGreaterThanOrEqual(0);
      expect(data.sentiment_score).toBeLessThanOrEqual(1);
      expect(data.fear_greed).toBeGreaterThanOrEqual(0);
      expect(data.fear_greed).toBeLessThanOrEqual(100);
    });
  });

  describe('generatePortfolioState', () => {
    it('returns portfolio with positions and total value', () => {
      const state = engine.generatePortfolioState();
      expect(state.positions.length).toBeGreaterThan(0);
      expect(state.total_value_usd).toBeGreaterThan(0);
      for (const pos of state.positions) {
        expect(pos).toHaveProperty('token');
        expect(pos).toHaveProperty('entry_price');
        expect(pos).toHaveProperty('current_price');
      }
    });
  });

  describe('generateNewToken', () => {
    it('returns new token with required fields', () => {
      const token = engine.generateNewToken();
      expect(token.token).toMatch(/^NEW/);
      expect(token).toHaveProperty('liquidity_usd');
      expect(token).toHaveProperty('social_score');
      expect(Array.isArray(token.red_flags)).toBe(true);
    });
  });

  describe('generateOrderbook', () => {
    it('returns orderbook with bid/ask spread', () => {
      const ob = engine.generateOrderbook();
      expect(ob.best_bid).toBeLessThan(ob.best_ask);
      expect(ob).toHaveProperty('quantity');
    });
  });

  describe('generateCopySignal', () => {
    it('returns copy signal data', () => {
      const sig = engine.generateCopySignal();
      expect(sig).toHaveProperty('whale_wallet');
      expect(sig).toHaveProperty('action');
      expect(sig).toHaveProperty('token');
      expect(sig).toHaveProperty('amount_usd');
      expect(sig.amount_usd).toBeGreaterThan(0);
    });
  });
});
