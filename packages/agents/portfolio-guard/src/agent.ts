import { BaseAgent } from '@trade/core';
import type { Signal } from '@trade/core';
import { PortfolioGuardStrategy, type PortfolioGuardConfig } from './strategy.js';

export class PortfolioGuardAgent extends BaseAgent {
  private strategy: PortfolioGuardStrategy;
  constructor(config: PortfolioGuardConfig) {
    super('portfolio-guard', { interval_ms: 5000 });
    this.strategy = new PortfolioGuardStrategy(config);
  }
  protected async tick(): Promise<void> {}
  protected async onSignal(signal: Signal): Promise<void> {
    if (signal.signal_type === 'trade_executed') {
      this.publishSignal('risk_breach', { action: 'monitoring', data: signal.data }, 1.0);
    }
  }
}
