import { BaseAgent } from '@trade/core';
import type { Signal } from '@trade/core';
import { WhaleTrackerStrategy, type WhaleTrackerConfig } from './strategy.js';

export class WhaleTrackerAgent extends BaseAgent {
  private strategy: WhaleTrackerStrategy;
  constructor(config: WhaleTrackerConfig) {
    super('whale-tracker', { interval_ms: 5000 });
    this.strategy = new WhaleTrackerStrategy(config);
  }
  protected async tick(): Promise<void> {}
  protected async onSignal(signal: Signal): Promise<void> {}
}
