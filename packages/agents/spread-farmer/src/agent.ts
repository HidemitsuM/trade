import { BaseAgent } from '@trade/core';
import type { Signal, SignalType } from '@trade/core';
import { SpreadFarmerStrategy, type SpreadFarmerConfig } from './strategy.js';
import { randomUUID } from 'node:crypto';

export class SpreadFarmerAgent extends BaseAgent {
  private strategy: SpreadFarmerStrategy;
  constructor(config: SpreadFarmerConfig) {
    super('spread-farmer', { interval_ms: 10000 });
    this.strategy = new SpreadFarmerStrategy(config);
  }

  getSubscribedSignalTypes(): SignalType[] {
    return ['spread_opportunity'];
  }

  protected async tick(): Promise<void> {
    if (!this.simulation) return;
    const orderbook = this.simulation.generateOrderbook();
    const decision = this.strategy.evaluate(orderbook);
    if (decision.should_trade) {
      this.publishSignal('spread_opportunity', {
        market: orderbook.market,
        best_bid: orderbook.best_bid,
        best_ask: orderbook.best_ask,
        spread_pct: decision.spread_pct,
        quantity: orderbook.quantity,
      }, Math.min(0.95, 0.4 + decision.spread_pct / 20));

      // Record simulated spread trade
      if (this.db) {
        const midPrice = (orderbook.best_bid + orderbook.best_ask) / 2;
        this.db.insertTrade({
          id: randomUUID(),
          agent: this.name,
          pair: orderbook.market,
          side: 'buy',
          entry_price: orderbook.best_ask,
          exit_price: orderbook.best_bid,
          quantity: orderbook.quantity,
          pnl: (orderbook.best_bid - orderbook.best_ask) * orderbook.quantity,
          fee: midPrice * orderbook.quantity * 0.001,
          chain: 'solana',
          tx_hash: null,
          simulated: true,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  protected async onSignal(signal: Signal): Promise<void> {}
}
