import { BaseAgent } from '@trade/core';
import type { Signal, SignalType } from '@trade/core';
import { PumpSniperStrategy, type PumpSniperConfig } from './strategy.js';
import { randomUUID } from 'node:crypto';

export class PumpSniperAgent extends BaseAgent {
  private strategy: PumpSniperStrategy;
  private agentConfig: PumpSniperConfig;
  constructor(config: PumpSniperConfig) {
    super('pump-sniper', { interval_ms: 5000 });
    this.agentConfig = config;
    this.strategy = new PumpSniperStrategy(config);
  }

  getSubscribedSignalTypes(): SignalType[] {
    return ['new_token'];
  }

  protected async tick(): Promise<void> {
    if (!this.simulation) return;
    const tokenData = this.simulation.generateNewToken();
    const decision = this.strategy.evaluate(tokenData);
    if (decision.should_buy) {
      this.publishSignal('new_token', {
        token: tokenData.token,
        liquidity_usd: tokenData.liquidity_usd,
        social_score: tokenData.social_score,
      }, tokenData.social_score);

      // Record simulated buy trade
      if (this.db) {
        const entryPrice = Math.max(0.001, tokenData.liquidity_usd / 1000000);
        this.db.insertTrade({
          id: randomUUID(),
          agent: this.name,
          pair: `${tokenData.token}/USDT`,
          side: 'buy',
          entry_price: entryPrice,
          exit_price: null,
          quantity: Math.round(this.agentConfig.max_position_usd / entryPrice),
          pnl: null,
          fee: entryPrice * 0.001,
          chain: 'solana',
          tx_hash: null,
          simulated: true,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  protected async onSignal(signal: Signal): Promise<void> {
    if (signal.signal_type === 'new_token') {
      this.publishSignal('risk_breach', { action: 'evaluating_new_token', data: signal.data }, signal.confidence);
    }
  }
}
