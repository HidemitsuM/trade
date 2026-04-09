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

  private async getTokenPrice(token: string): Promise<number> {
    const coinId = token.toLowerCase() === 'sol' ? 'solana'
      : token.toLowerCase() === 'btc' ? 'bitcoin'
      : token.toLowerCase() === 'eth' ? 'ethereum'
      : token.toLowerCase();
    const res = await this.mcpPool!.callTool('coingecko', 'get_price', { coin_id: coinId });
    if (!res || typeof (res as any).price !== 'number' || (res as any).price <= 0) {
      throw new Error(`Invalid CoinGecko price for ${token}: ${JSON.stringify(res)}`);
    }
    return (res as { price: number }).price;
  }

  protected async tick(): Promise<void> {
    // Signal-driven mode — copy trades handled via onSignal when whale_move arrives
  }

  protected async onSignal(signal: Signal): Promise<void> {
    if (signal.signal_type !== 'whale_move') return;

    const whaleData = {
      whale_wallet: String(signal.data.wallet || ''),
      action: String(signal.data.action || 'buy'),
      token: String(signal.data.token || 'SOL'),
      amount_usd: Number(signal.data.amount_usd || 0),
    };

    const decision = this.strategy.evaluate(whaleData);
    if (!decision.should_copy) return;

    this.publishSignal('trade_executed', {
      token: whaleData.token,
      amount_usd: decision.copy_amount_usd,
      action: 'copy_buy',
      whale_wallet: whaleData.whale_wallet,
    }, signal.confidence * 0.9);

    if (this.db) {
      let price: number;
      if (!this.isSimulation && this.mcpPool) {
        try {
          price = await this.getTokenPrice(whaleData.token);
        } catch {
          logger.warn(`Agent ${this.name} price fetch failed, skipping trade record`);
          return;
        }
      } else {
        price = 100;
      }
      const quantity = decision.copy_amount_usd / price;
      this.db.insertTrade({
        id: randomUUID(),
        agent: this.name,
        pair: `${whaleData.token}/USDT`,
        side: 'buy',
        entry_price: price,
        exit_price: null,
        quantity,
        pnl: null,
        fee: decision.copy_amount_usd * 0.001,
        chain: 'solana',
        tx_hash: null,
        simulated: this.isSimulation,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
