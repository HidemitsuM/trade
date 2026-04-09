import { BaseAgent, logger } from '@trade/core';
import type { Signal, SignalType } from '@trade/core';
import { NewsEdgeStrategy, type NewsEdgeConfig } from './strategy.js';
import { randomUUID } from 'node:crypto';

const TOKENS = ['BTC', 'ETH', 'SOL', 'BNB', 'MATIC', 'AVAX', 'DOGE', 'PEPE'];

export class NewsEdgeAgent extends BaseAgent {
  private strategy: NewsEdgeStrategy;
  private lastFearGreed: number = 50;
  constructor(config: NewsEdgeConfig) {
    super('news-edge', { interval_ms: 60000 });
    this.strategy = new NewsEdgeStrategy(config);
  }

  private async fetchRealSentiment(): Promise<{ token: string; sentiment_score: number; fear_greed: number; source: string }> {
    const fgRaw = await this.mcpPool!.callTool('coinmarketcap', 'get_fear_greed', {});
    if (!fgRaw || typeof (fgRaw as any).value !== 'number' || (fgRaw as any).value < 0 || (fgRaw as any).value > 100) {
      throw new Error(`Invalid Fear&Greed response: ${JSON.stringify(fgRaw)}`);
    }
    const fg = fgRaw as { value: number; classification: string };
    this.lastFearGreed = fg.value;
    const sentimentScore = fg.value / 100;
    const token = TOKENS[Math.floor(Math.random() * TOKENS.length)];
    return { token, sentiment_score: sentimentScore, fear_greed: fg.value, source: 'coinmarketcap' };
  }

  private async getTokenPrice(token: string): Promise<number> {
    const coinId = token.toLowerCase() === 'sol' ? 'solana'
      : token.toLowerCase() === 'btc' ? 'bitcoin'
      : token.toLowerCase() === 'eth' ? 'ethereum'
      : token.toLowerCase();
    const res = await this.mcpPool!.callTool('coingecko', 'get_price', { coin_id: coinId });
    if (!res || typeof (res as any).price !== 'number' || (res as any).price <= 0) {
      throw new Error(`Invalid CoinGecko price for ${token}: ${JSON.stringify(res)}`);
    }
    return (res as { price: number }).price;
  }

  protected async tick(): Promise<void> {
    if (!this.simulation) return;
    let data: { token: string; sentiment_score: number; fear_greed: number; source: string };

    if (this.isSimulation || !this.mcpPool) {
      data = this.simulation.generateSentimentData();
    } else {
      try {
        data = await this.fetchRealSentiment();
      } catch (err) {
        logger.warn(`Agent ${this.name} MCP error, falling back to simulation`, { error: String(err) });
        data = this.simulation.generateSentimentData();
      }
    }

    const decision = this.strategy.evaluate(data);
    if (decision.should_enter) {
      this.publishSignal('sentiment_shift', {
        token: data.token,
        sentiment_score: data.sentiment_score,
        fear_greed: data.fear_greed,
        source: data.source,
      }, data.sentiment_score);

      if (this.db) {
        let entryPrice: number;
        if (!this.isSimulation && this.mcpPool) {
          try {
            entryPrice = await this.getTokenPrice(data.token);
          } catch {
            logger.warn(`Agent ${this.name} price fetch failed, skipping trade record`);
            return;
          }
        } else {
          entryPrice = 100;
        }
        this.db.insertTrade({
          id: randomUUID(),
          agent: this.name,
          pair: `${data.token}/USDT`,
          side: 'buy',
          entry_price: entryPrice,
          exit_price: null,
          quantity: 1,
          pnl: null,
          fee: entryPrice * 0.001,
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
