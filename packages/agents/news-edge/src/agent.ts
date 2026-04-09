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
    const fg = await this.mcpPool!.callTool('coinmarketcap', 'get_fear_greed', {}) as { value: number; classification: string };
    this.lastFearGreed = fg.value;
    const sentimentScore = fg.value / 100;
    const token = TOKENS[Math.floor(Math.random() * TOKENS.length)];
    return { token, sentiment_score: sentimentScore, fear_greed: fg.value, source: 'coinmarketcap' };
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
        const entryPrice = data.token === 'BTC' ? 50000 : data.token === 'ETH' ? 3000 : 150;
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
          chain: 'ethereum',
          tx_hash: null,
          simulated: this.isSimulation,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  protected async onSignal(signal: Signal): Promise<void> {}
}
