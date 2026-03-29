import { BaseAgent } from '@trade/core';
import type { Signal } from '@trade/core';
import { PumpSniperStrategy, type PumpSniperConfig } from './strategy.js';

export class PumpSniperAgent extends BaseAgent {
  private strategy: PumpSniperStrategy;
  constructor(config: PumpSniperConfig) {
    super('pump-sniper', { interval_ms: 5000 });
    this.strategy = new PumpSniperStrategy(config);
  }
  protected async tick(): Promise<void> {}
  protected async onSignal(signal: Signal): Promise<void> {
    if (signal.signal_type === 'new_token') {
      this.publishSignal('risk_breach', { action: 'evaluating_new_token', data: signal.data }, signal.confidence);
    }
  }
}
