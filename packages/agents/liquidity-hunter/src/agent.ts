import { BaseAgent } from '@trade/core';
import type { Signal } from '@trade/core';
import { LiquidityHunterStrategy, type LiquidityHunterConfig } from './strategy.js';

export class LiquidityHunterAgent extends BaseAgent {
  private strategy: LiquidityHunterStrategy;
  constructor(config: LiquidityHunterConfig) {
    super('liquidity-hunter', { interval_ms: 5000 });
    this.strategy = new LiquidityHunterStrategy(config);
  }
  protected async tick(): Promise<void> {}
  protected async onSignal(signal: Signal): Promise<void> {}
}
