import { BaseAgent } from '@trade/core';
import type { Signal } from '@trade/core';
import { CopyTraderStrategy, type CopyTraderConfig } from './strategy.js';

export class CopyTraderAgent extends BaseAgent {
  private strategy: CopyTraderStrategy;
  constructor(config: CopyTraderConfig) {
    super('copy-trader', { interval_ms: 5000 });
    this.strategy = new CopyTraderStrategy(config);
  }
  protected async tick(): Promise<void> {}
  protected async onSignal(signal: Signal): Promise<void> {
    if (signal.signal_type === 'whale_move') {
      const decision = this.strategy.evaluate({ whale_wallet: String(signal.data.wallet), action: String(signal.data.action), token: String(signal.data.token), amount_usd: Number(signal.data.amount_usd) });
      if (decision.should_copy) {
        this.publishSignal('trade_executed', { token: signal.data.token, amount_usd: decision.copy_amount_usd }, signal.confidence);
      }
    }
  }
}
