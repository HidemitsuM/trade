import { BaseAgent } from '@trade/core';
import type { Signal, SignalType } from '@trade/core';
import { CopyTraderStrategy, type CopyTraderConfig } from './strategy.js';
import { randomUUID } from 'node:crypto';

export class CopyTraderAgent extends BaseAgent {
  private strategy: CopyTraderStrategy;
  constructor(config: CopyTraderConfig) {
    super('copy-trader', { interval_ms: 5000 });
    this.strategy = new CopyTraderStrategy(config);
  }

  getSubscribedSignalTypes(): SignalType[] {
    return ['whale_move'];
  }

  protected async tick(): Promise<void> {
    if (!this.simulation) return;
    const signal = this.simulation.generateCopySignal();
    const decision = this.strategy.evaluate(signal);
    if (decision.should_copy) {
      this.publishSignal('trade_executed', {
        token: signal.token,
        amount_usd: decision.copy_amount_usd,
        action: 'copy_buy',
        whale_wallet: signal.whale_wallet,
      }, 0.7);

      // Record simulated copy trade
      if (this.db) {
        const price = signal.token === 'BTC' ? 50000
          : signal.token === 'ETH' ? 3000
          : signal.token === 'SOL' ? 150 : 100;
        const quantity = decision.copy_amount_usd / price;
        this.db.insertTrade({
          id: randomUUID(),
          agent: this.name,
          pair: `${signal.token}/USDT`,
          side: 'buy',
          entry_price: price,
          exit_price: null,
          quantity,
          pnl: null,
          fee: decision.copy_amount_usd * 0.001,
          chain: 'ethereum',
          tx_hash: null,
          simulated: true,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  protected async onSignal(signal: Signal): Promise<void> {
    if (signal.signal_type === 'whale_move') {
      const decision = this.strategy.evaluate({ whale_wallet: String(signal.data.wallet), action: String(signal.data.action), token: String(signal.data.token), amount_usd: Number(signal.data.amount_usd) });
      if (decision.should_copy) {
        this.publishSignal('trade_executed', { token: signal.data.token, amount_usd: decision.copy_amount_usd }, signal.confidence);
      }
    }
  }
}
