import { BaseAgent } from '@trade/core';
import type { Signal } from '@trade/core';
import { ArbStrategy, type ArbConfig } from './strategy.js';

export class ArbScannerAgent extends BaseAgent {
  private strategy: ArbStrategy;
  constructor(config: ArbConfig) {
    super('arb-scanner', { interval_ms: 3000 });
    this.strategy = new ArbStrategy(config);
  }
  protected async tick(): Promise<void> {}
  protected async onSignal(signal: Signal): Promise<void> {
    if (signal.signal_type === 'whale_move') {
      this.publishSignal('price_gap', { source: 'whale', data: signal.data }, signal.confidence * 0.8);
    }
  }
}
