import { BaseAgent, logger } from '@trade/core';
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
    // Copy trading depends on real-time whale data — always simulation for now
    if (!this.isSimulation && this.mcpPool) {
      logger.debug(`Agent ${this.name} using simulation (depends on whale-tracker real-time data)`);
    }

    const signal = this.simulation.generateCopySignal();
    const decision = this.strategy.evaluate(signal);
    if (decision.should_copy) {
      this.publishSignal('trade_executed', {
        token: signal.token,
        amount_usd: decision.copy_amount_usd,
        action: 'copy_buy',
        whale_wallet: signal.whale_wallet,
      }, 0.7);

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
          simulated: this.isSimulation,
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
