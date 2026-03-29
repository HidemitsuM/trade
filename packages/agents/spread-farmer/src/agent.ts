import { BaseAgent } from '@trade/core';
import type { Signal } from '@trade/core';
import { SpreadFarmerStrategy, type SpreadFarmerConfig } from './strategy.js';

export class SpreadFarmerAgent extends BaseAgent {
  private strategy: SpreadFarmerStrategy;
  constructor(config: SpreadFarmerConfig) {
    super('spread-farmer', { interval_ms: 10000 });
    this.strategy = new SpreadFarmerStrategy(config);
  }
  protected async tick(): Promise<void> {}
  protected async onSignal(signal: Signal): Promise<void> {}
}
