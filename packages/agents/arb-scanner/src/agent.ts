import { BaseAgent } from '@trade/core';
import type { Signal } from '@trade/core';
import { ArbStrategy, type ArbConfig } from './strategy.js';
import { randomUUID } from 'node:crypto';

export class ArbScannerAgent extends BaseAgent {
  private strategy: ArbStrategy;
  constructor(config: ArbConfig) {
    super('arb-scanner', { interval_ms: 3000 });
    this.strategy = new ArbStrategy(config);
  }
  protected async tick(): Promise<void> {
    if (!this.simulation) return;
    const priceData = this.simulation.generateArbPrices();
    for (const prices of priceData) {
      const opportunity = this.strategy.analyze(prices);
      if (opportunity) {
        this.publishSignal('price_gap', {
          pair: opportunity.pair,
          buyPrice: opportunity.buyPrice,
          sellPrice: opportunity.sellPrice,
          quantity: opportunity.quantity,
          profit: opportunity.profit,
        }, Math.min(0.95, 0.5 + opportunity.profit / 100));

        // Record simulated trade
        if (this.db) {
          const fee = opportunity.profit * 0.001;
          this.db.insertTrade({
            id: randomUUID(),
            agent: this.name,
            pair: opportunity.pair,
            side: 'buy',
            entry_price: opportunity.buyPrice,
            exit_price: opportunity.sellPrice,
            quantity: opportunity.quantity,
            pnl: opportunity.profit - fee,
            fee,
            chain: 'solana',
            tx_hash: null,
            simulated: true,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
  }
  protected async onSignal(signal: Signal): Promise<void> {
    if (signal.signal_type === 'whale_move') {
      this.publishSignal('price_gap', { source: 'whale', data: signal.data }, signal.confidence * 0.8);
    }
  }
}
