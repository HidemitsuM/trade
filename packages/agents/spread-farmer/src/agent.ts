import { BaseAgent, logger } from '@trade/core';
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

  private async fetchRealOrderbook(): Promise<{ market: string; best_bid: number; best_ask: number; quantity: number }> {
    // Use Jupiter quote to estimate spread on SOL/USDT
    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const quote = await this.mcpPool!.callTool('jupiter', 'get_quote', {
      inputMint: SOL_MINT, outputMint: USDC_MINT, amount: 1000000000,
    }) as { inAmount: string; outAmount: string; priceImpactPct: number };

    const mid = Number(quote.outAmount) / 1e6; // USDC has 6 decimals
    const halfSpread = mid * quote.priceImpactPct / 200;
    return {
      market: 'SOL/USDT',
      best_bid: mid - halfSpread,
      best_ask: mid + halfSpread,
      quantity: Math.round(Math.random() * 500 + 10),
    };
  }

  protected async tick(): Promise<void> {
    if (!this.simulation) return;
    let orderbook: { market: string; best_bid: number; best_ask: number; quantity: number };

    if (this.isSimulation || !this.mcpPool) {
      orderbook = this.simulation.generateOrderbook();
    } else {
      try {
        orderbook = await this.fetchRealOrderbook();
      } catch (err) {
        logger.warn(`Agent ${this.name} MCP error, falling back to simulation`, { error: String(err) });
        orderbook = this.simulation.generateOrderbook();
      }
    }

    const decision = this.strategy.evaluate(orderbook);
    if (decision.should_trade) {
      this.publishSignal('spread_opportunity', {
        market: orderbook.market,
        best_bid: orderbook.best_bid,
        best_ask: orderbook.best_ask,
        spread_pct: decision.spread_pct,
        quantity: orderbook.quantity,
      }, Math.min(0.95, 0.4 + decision.spread_pct / 20));

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
          simulated: this.isSimulation,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  protected async onSignal(signal: Signal): Promise<void> {}
}
