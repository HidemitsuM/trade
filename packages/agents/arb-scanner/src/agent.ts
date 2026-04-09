import { BaseAgent, logger } from '@trade/core';
import type { Signal } from '@trade/core';
import { ArbStrategy, type ArbConfig } from './strategy.js';
import { randomUUID } from 'node:crypto';

const TOKEN_MAP: Record<string, string> = {
  solana: 'SOL',
};

export class ArbScannerAgent extends BaseAgent {
  private strategy: ArbStrategy;
  constructor(config: ArbConfig) {
    super('arb-scanner', { interval_ms: 3000 });
    this.strategy = new ArbStrategy(config);
  }

  private async fetchRealPrices(): Promise<{ pair: string; buyPrice: number; sellPrice: number; quantity: number }[]> {
    const results: { pair: string; buyPrice: number; sellPrice: number; quantity: number }[] = [];
    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

    for (const [coinId, symbol] of Object.entries(TOKEN_MAP)) {
      // Fetch CEX price from CoinGecko
      const cexRes = await this.mcpPool!.callTool('coingecko', 'get_price', { coin_id: coinId });
      if (!cexRes || typeof (cexRes as any).price !== 'number' || (cexRes as any).price <= 0) {
        throw new Error(`Invalid CoinGecko response for ${coinId}: ${JSON.stringify(cexRes)}`);
      }
      const cexPrice = (cexRes as { price: number }).price;

      if (symbol === 'SOL') {
        // Fetch DEX price from Jupiter for SOL/USDC
        const dexRes = await this.mcpPool!.callTool('jupiter', 'get_quote', {
          input_mint: SOL_MINT, output_mint: USDC_MINT, amount: 1_000_000_000,
        });
        if (!dexRes || typeof (dexRes as any).outAmount !== 'string') {
          throw new Error(`Invalid Jupiter response for SOL: ${JSON.stringify(dexRes)}`);
        }
        const dexPrice = Number((dexRes as { outAmount: string }).outAmount) / 1e6;
        const buyPrice = Math.min(cexPrice, dexPrice);
        const sellPrice = Math.max(cexPrice, dexPrice);
        if (sellPrice > buyPrice) {
          results.push({ pair: 'SOL/USDT', buyPrice, sellPrice, quantity: 1 });
        }
      }
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
