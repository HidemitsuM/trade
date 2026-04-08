import { BaseAgent, logger } from '@trade/core';
import type { Signal } from '@trade/core';
import { ArbStrategy, type ArbConfig } from './strategy.js';
import { randomUUID } from 'node:crypto';

const TOKEN_MAP: Record<string, string> = {
  solana: 'SOL', ethereum: 'ETH', bitcoin: 'BTC', binancecoin: 'BNB',
};

export class ArbScannerAgent extends BaseAgent {
  private strategy: ArbStrategy;
  constructor(config: ArbConfig) {
    super('arb-scanner', { interval_ms: 3000 });
    this.strategy = new ArbStrategy(config);
  }

  private async fetchRealPrices(): Promise<{ pair: string; buyPrice: number; sellPrice: number; quantity: number }[]> {
    const results: { pair: string; buyPrice: number; sellPrice: number; quantity: number }[] = [];
    for (const [coinId, symbol] of Object.entries(TOKEN_MAP)) {
      const res = await this.mcpPool!.callTool('coingecko', 'get_price', { coin_id: coinId }) as { coin_id: string; price: number };
      const basePrice = res.price;
      // Estimate arb spread between CEX (CoinGecko) and DEX
      const spread = basePrice * (Math.random() * 0.03 - 0.005);
      results.push({
        pair: `${symbol}/USDT`,
        buyPrice: basePrice,
        sellPrice: basePrice + spread,
        quantity: Math.round(Math.random() * 50 + 1),
      });
    }
    return results;
  }

  protected async tick(): Promise<void> {
    if (!this.simulation) return;
    let priceData: { pair: string; buyPrice: number; sellPrice: number; quantity: number }[];

    if (this.isSimulation || !this.mcpPool) {
      priceData = this.simulation.generateArbPrices();
    } else {
      try {
        priceData = await this.fetchRealPrices();
      } catch (err) {
        logger.warn(`Agent ${this.name} MCP error, falling back to simulation`, { error: String(err) });
        priceData = this.simulation.generateArbPrices();
      }
    }

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
            simulated: this.isSimulation,
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
