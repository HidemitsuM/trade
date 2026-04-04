import { BaseAgent } from '@trade/core';
import type { Signal, SignalType } from '@trade/core';
import { PortfolioGuardStrategy, type PortfolioGuardConfig } from './strategy.js';
import { randomUUID } from 'node:crypto';

export class PortfolioGuardAgent extends BaseAgent {
  private strategy: PortfolioGuardStrategy;
  constructor(config: PortfolioGuardConfig) {
    super('portfolio-guard', { interval_ms: 5000 });
    this.strategy = new PortfolioGuardStrategy(config);
  }

  getSubscribedSignalTypes(): SignalType[] {
    return ['trade_executed', 'risk_breach'];
  }

  protected async tick(): Promise<void> {
    if (!this.simulation) return;
    const portfolio = this.simulation.generatePortfolioState();
    const action = this.strategy.evaluate(portfolio);

    if (action.stop_loss_triggered || action.rebalance_needed) {
      this.publishSignal('risk_breach', {
        stop_loss_triggered: action.stop_loss_triggered,
        rebalance_needed: action.rebalance_needed,
        tokens_to_sell: action.tokens_to_sell,
        total_value_usd: portfolio.total_value_usd,
      }, action.stop_loss_triggered ? 0.95 : 0.7);

      // Record simulated sell trades for flagged tokens
      if (this.db) {
        for (const token of action.tokens_to_sell) {
          const pos = portfolio.positions.find((p) => p.token === token);
          if (pos) {
            this.db.insertTrade({
              id: randomUUID(),
              agent: this.name,
              pair: `${token}/USDT`,
              side: 'sell',
              entry_price: pos.entry_price,
              exit_price: pos.current_price,
              quantity: 1,
              pnl: pos.current_price - pos.entry_price,
              fee: pos.current_price * 0.001,
              chain: 'solana',
              tx_hash: null,
              simulated: true,
              timestamp: new Date().toISOString(),
            });
          }
        }
      }
    }
  }

  protected async onSignal(signal: Signal): Promise<void> {
    if (signal.signal_type === 'trade_executed') {
      this.publishSignal('risk_breach', { action: 'monitoring', data: signal.data }, 1.0);
    }
  }
}
