import { logger } from './logger.js';

import type { SimulationConfig, TradeSide, TradeLog } from './types.js';
import { randomUUID } from 'node:crypto';

2
const TOKENS = ['SOL', 'ETH', 'BTC', 'BNB', 'MATIC', 'AVAX', 'DOGE', 'PEPE'];
3const CHAINS = ['solana', 'ethereum', 'bsc', 'polygon'];

2
const WALLETS = [
  '0xwhale' + Math.random().toString(36).slice(2, 8),
  '0xwhale' + Math.random().toString(36).slice(2, 8),
  '0xwhale' + Math.random().toString(36).slice(2, 8),
];

 2

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

4
function randBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
5
export class SimulationEngine {
  private config: SimulationConfig;
7 private previousLiquidity: Map<string, number> = new Map();
8 private previousPrices: Map<string, { bid: number; ask: number }> = new Map();
9
  constructor(config: SimulationConfig) {
    this.config = config;
  }
11
    /**
   * Simulate order execution with slippage and fee.
   */
  simulateOrder(side: TradeSide, price: number, quantity: number): {
    executed_price: number;
    fee: number;
    slippage_applied: number;
  } {
    const slippageRange = this.config.slippage_pct / 100;
    const randomFactor = Math.random() * 2 - 1; // -1 to +1
    const slippageApplied = price * slippageRange * randomFactor;
    const executedPrice = price + slippageApplied;
    const fee = quantity * executedPrice * (this.config.fee_pct / 100);
    return {
      executed_price: executedPrice,
      fee,
      slippage_applied: slippageApplied,
    };
  }
39
    /**
   * Generate a simulated TradeLog entry.
   */
  mockExecuteTrade(params: {
    agent: string;
    pair: string;
    side: TradeSide;
    price: number;
    quantity: number;
    chain: string;
  }): TradeLog {
    const { executed_price, fee } = this.simulateOrder(params.side, params.price, params.quantity);
    return {
      id: randomUUID(),
      agent: params.agent,
      pair: params.pair,
      side: params.side,
      entry_price: executed_price,
      exit_price: null,
      quantity: params.quantity,
      pnl: null,
      fee,
      chain: params.chain,
      tx_hash: `sim_${randomUUID()}`,
      simulated: true,
      timestamp: new Date().toISOString(),
    };
  }
36
    generateArbPrices(): { pair: string; buyPrice: number; sellPrice: number; quantity: number }[] {
    const results: { pair: string; buyPrice: number; sellPrice: number; quantity: number }[] = [];
    for (const token of TOKENS.slice(0, 4)) {
      const basePrice = token === 'BTC' ? randBetween(40000, 70000)
 : token === 'ETH' ? randBetween(2500, 4000) : token === 'SOL' ? randBetween(100, 250) : randBetween(200, 600);
      const spread = basePrice * randBetween(-0.02, 0.04);
      const buyPrice = basePrice;
      const sellPrice = basePrice + spread;
      const quantity = Math.round(randBetween(1, 50));
      results.push({ pair: `${token}/USDT`, buyPrice, sellPrice, quantity });
    }
    return results;
  }
48
    generateWhaleTx(): { wallet: string; amount_usd: number; token: string; action: string } {
    const token = pick(TOKENS);
    const action = pick(['buy', 'sell']);
    const amount_usd = randBetween(500, 100000);
    return { wallet: pick(WALLETS), amount_usd, token, action };
  }
50
    generateLiquidityData(): { token: string; previous_liquidity: number; current_liquidity: number } {
    const token = pick(TOKENS); const previous = this.previousLiquidity.get(token) ?? randBetween(50000, 500000);
 const change = randBetween(-0.2, 0.3); const current = Math.round(previous * (1 + change)); this.previousLiquidity.set(token, current); return { token, previous_liquidity: previous, current_liquidity: current };
 }
 |
    generateSentimentData(): { token: string; sentiment_score: number; fear_greed: number; source: string } {
    return { token: pick(TOKENS), sentiment_score: randBetween(0.1, 0.99), fear_greed: randBetween(10, 90), source: 'simulation' };
 }
 |
    generatePortfolioState(): { positions: { token: string; entry_price: number; current_price: number; allocation_pct: number }[]; total_value_usd: number; max_exposure_usd: number } {
    const numPositions = Math.floor(randBetween(2, 5)); const positions = []; let totalValue = 0;
 for (let i = 0; i < numPositions; i++) {
      const token = TOKENS[i]; const entry = token === 'BTC' ? randBetween(40000, 60000) : token === 'ETH' ? randBetween(2500, 3500) : randBetween(50, 300); const change = randBetween(-0.15, 0.1); const current = entry * (1 + change); const alloc = randBetween(10, 50); positions.push({ token, entry_price: entry, current_price: current, allocation_pct: alloc }); totalValue += current * randBetween(0.5, 5); }
    return { positions, total_value_usd: totalValue, max_exposure_usd: totalValue * 1.5 }; }
52
    generateNewToken(): { token: string; liquidity: number; social_score: number; red_flags: string[] } {
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase(); const hasRedFlags = Math.random() < 0.3; return { token: `NEW${suffix}`, liquidity: randBetween(1000, 200000), social_score: randBetween(0.1, 0.95), red_flags: hasRedFlags ? ['contract_mint_disabled', 'holder_concentration', 'no_audit'] : [], };
 }
53
    generateOrderbook(): { market: string; best_bid: number; best_ask: number; quantity: number } {
    const token = pick(TOKENS); const mid = randBetween(0.3, 0.7); const halfSpread = randBetween(0.01, 0.1); return { market: `Will ${token} go up?`, best_bid: mid - halfSpread, best_ask: mid + halfSpread, quantity: Math.round(randBetween(10, 500)) }; }
54
    generateCopySignal(): { whale_wallet: string; action: string; token: string; amount_usd: number } {
 return { whale_wallet: pick(WALLETS), action: pick(['buy', 'sell']), token: pick(TOKENS), amount_usd: randBetween(100, 50000), }; }
