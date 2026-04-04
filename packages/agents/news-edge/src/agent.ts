import { BaseAgent } from '@trade/core';
import type { Signal, SignalType } from '@trade/core';
import { NewsEdgeStrategy, type NewsEdgeConfig } from './strategy.js';
import { randomUUID } from 'node:crypto';

export class NewsEdgeAgent extends BaseAgent {
  private strategy: NewsEdgeStrategy;
  constructor(config: NewsEdgeConfig) {
    super('news-edge', { interval_ms: 60000 });
    this.strategy = new NewsEdgeStrategy(config);
  }

  getSubscribedSignalTypes(): SignalType[] {
    return ['sentiment_shift'];
  }

  protected async tick(): Promise<void> {
    if (!this.simulation) return;
    const data = this.simulation.generateSentimentData();
    const decision = this.strategy.evaluate(data);
    if (decision.should_enter) {
      this.publishSignal('sentiment_shift', {
        token: data.token,
        sentiment_score: data.sentiment_score,
        fear_greed: data.fear_greed,
        source: data.source,
      }, data.sentiment_score);

      // Record simulated trade
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
          simulated: true,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  protected async onSignal(signal: Signal): Promise<void> {}
}
