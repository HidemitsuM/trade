import { randomUUID } from 'node:crypto';
import type { SimulationConfig, TradeSide, TradeLog } from './types.js';

export class SimulationEngine {
  private config: SimulationConfig;

  constructor(config: SimulationConfig) {
    this.config = config;
  }

  /**
   * Simulate order execution with slippage and fee.
   * Slippage: price is randomly adjusted within ±slippage_pct%.
   * Fee: quantity * executed_price * fee_pct / 100.
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
}

/**
 * Factory function to create a SimulationEngine from a SimulationConfig.
 */
export function createSimulationEngine(config: SimulationConfig): SimulationEngine {
  return new SimulationEngine(config);
}
