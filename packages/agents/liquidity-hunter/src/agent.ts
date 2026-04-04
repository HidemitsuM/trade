import { BaseAgent } from '@trade/core';
import type { Signal, SignalType } from '@trade/core';
import { LiquidityHunterStrategy, type LiquidityHunterConfig } from './strategy.js';

export class LiquidityHunterAgent extends BaseAgent {
  private strategy: LiquidityHunterStrategy;
  constructor(config: LiquidityHunterConfig) {
    super('liquidity-hunter', { interval_ms: 5000 });
    this.strategy = new LiquidityHunterStrategy(config);
  }

  getSubscribedSignalTypes(): SignalType[] {
    return ['liquidity_change'];
  }

  protected async tick(): Promise<void> {
    if (!this.simulation) return;
    const data = this.simulation.generateLiquidityData();
    const alert = this.strategy.analyze(data);
    if (alert) {
      this.publishSignal('liquidity_change', {
        token: alert.token,
        previous_liquidity: alert.previous_liquidity,
        current_liquidity: alert.current_liquidity,
        change_pct: alert.change_pct,
      }, Math.min(0.95, 0.4 + Math.abs(alert.change_pct) / 50));
    }
  }

  protected async onSignal(signal: Signal): Promise<void> {}
}
