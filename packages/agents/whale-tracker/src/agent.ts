import { BaseAgent } from '@trade/core';
import type { Signal, SignalType } from '@trade/core';
import { WhaleTrackerStrategy, type WhaleTrackerConfig } from './strategy.js';

export class WhaleTrackerAgent extends BaseAgent {
  private strategy: WhaleTrackerStrategy;
  constructor(config: WhaleTrackerConfig) {
    super('whale-tracker', { interval_ms: 5000 });
    this.strategy = new WhaleTrackerStrategy(config);
  }

  getSubscribedSignalTypes(): SignalType[] {
    return [];
  }

  protected async tick(): Promise<void> {
    if (!this.simulation) return;
    const tx = this.simulation.generateWhaleTx();
    const alert = this.strategy.analyze(tx);
    if (alert) {
      this.publishSignal('whale_move', {
        wallet: alert.wallet,
        token: alert.token,
        action: alert.action,
        amount_usd: alert.amount_usd,
      }, Math.min(0.99, 0.5 + alert.amount_usd / 200000));
    }
  }

  protected async onSignal(signal: Signal): Promise<void> {}
}
