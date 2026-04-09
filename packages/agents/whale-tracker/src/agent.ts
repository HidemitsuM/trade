import { BaseAgent, logger } from '@trade/core';
import type { Signal, SignalType } from '@trade/core';
import { WhaleTrackerStrategy, type WhaleTrackerConfig } from './strategy.js';

export class WhaleTrackerAgent extends BaseAgent {
  private strategy: WhaleTrackerStrategy;
  private watchAddresses: string[] = [];
  private lastSeenSignatures: Map<string, string> = new Map();

  constructor(config: WhaleTrackerConfig) {
    super('whale-tracker', { interval_ms: 5000 });
    this.strategy = new WhaleTrackerStrategy(config);
  }

  setWatchAddresses(addresses: string[]): void {
    this.watchAddresses = addresses;
  }

  getSubscribedSignalTypes(): SignalType[] {
    return [];
  }

  private async pollWhaleTransactions(): Promise<{ wallet: string; amount_usd: number; token: string; action: string }[]> {
    const results: { wallet: string; amount_usd: number; token: string; action: string }[] = [];

    for (const address of this.watchAddresses) {
      try {
        const sigsRes = await this.mcpPool!.callTool('helius', 'get_signatures_for_address', {
          address, limit: 5,
        });
        if (!sigsRes || !Array.isArray(sigsRes)) {
          throw new Error(`Invalid signatures response for ${address}: ${JSON.stringify(sigsRes)}`);
        }
        const sigs = sigsRes as Array<{ signature: string; blockTime: number | null; err: unknown }>;

        const lastSeen = this.lastSeenSignatures.get(address);
        for (const sig of sigs) {
          if (sig.err) continue;
          if (lastSeen && sig.signature === lastSeen) break;

          const txRes = await this.mcpPool!.callTool('helius', 'get_transaction', {
            signature: sig.signature,
          });
          if (!txRes || !(txRes as any).meta) continue;

          const meta = (txRes as any).meta;
          const preBalances: number[] = meta.preBalances || [];
          const postBalances: number[] = meta.postBalances || [];
          let solChange = 0;
          for (let i = 0; i < Math.min(preBalances.length, postBalances.length); i++) {
            const change = Math.abs(postBalances[i] - preBalances[i]);
            if (change > solChange) solChange = change;
          }

          const solAmount = solChange / 1e9;
          const priceRes = await this.mcpPool!.callTool('coingecko', 'get_price', { coin_id: 'solana' });
          if (!priceRes || typeof (priceRes as any).price !== 'number') continue;
          const solPrice = (priceRes as { price: number }).price;
          const amountUsd = solAmount * solPrice;

          if (amountUsd > 0) {
            results.push({
              wallet: address,
              amount_usd: amountUsd,
              token: 'SOL',
              action: postBalances[0] > preBalances[0] ? 'buy' : 'sell',
            });
          }
        }

        if (sigs.length > 0 && !sigs[0].err) {
          this.lastSeenSignatures.set(address, sigs[0].signature);
        }
      } catch (err) {
        logger.warn(`Agent ${this.name} failed to poll ${address}`, { error: String(err) });
      }
    }

    return results;
  }

  protected async tick(): Promise<void> {
    if (this.isSimulation || !this.mcpPool || this.watchAddresses.length === 0) {
      const tx = this.simulation!.generateWhaleTx();
      const alert = this.strategy.analyze(tx);
      if (alert) {
        this.publishSignal('whale_move', {
          wallet: alert.wallet, token: alert.token, action: alert.action, amount_usd: alert.amount_usd,
        }, Math.min(0.99, 0.5 + alert.amount_usd / 200000));
      }
      return;
    }

    try {
      const transactions = await this.pollWhaleTransactions();
      for (const tx of transactions) {
        const alert = this.strategy.analyze(tx);
        if (alert) {
          this.publishSignal('whale_move', {
            wallet: alert.wallet, token: alert.token, action: alert.action, amount_usd: alert.amount_usd,
          }, Math.min(0.99, 0.5 + alert.amount_usd / 200000));
        }
      }
    } catch (err) {
      logger.warn(`Agent ${this.name} polling error, falling back to simulation`, { error: String(err) });
      const tx = this.simulation!.generateWhaleTx();
      const alert = this.strategy.analyze(tx);
      if (alert) {
        this.publishSignal('whale_move', {
          wallet: alert.wallet, token: alert.token, action: alert.action, amount_usd: alert.amount_usd,
        }, Math.min(0.99, 0.5 + alert.amount_usd / 200000));
      }
    }
  }

  protected async onSignal(signal: Signal): Promise<void> {}
}
