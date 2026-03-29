import { BaseAgent } from '@trade/core';
import type { Signal } from '@trade/core';
import { NewsEdgeStrategy, type NewsEdgeConfig } from './strategy.js';

export class NewsEdgeAgent extends BaseAgent {
  private strategy: NewsEdgeStrategy;
  constructor(config: NewsEdgeConfig) {
    super('news-edge', { interval_ms: 60000 });
    this.strategy = new NewsEdgeStrategy(config);
  }
  protected async tick(): Promise<void> {}
  protected async onSignal(signal: Signal): Promise<void> {}
}
