export interface WhaleTrackerConfig { min_whale_usd: number; }
export interface WhaleAlert { wallet: string; token: string; action: string; amount_usd: number; }

export class WhaleTrackerStrategy {
  private config: WhaleTrackerConfig;
  constructor(config: WhaleTrackerConfig) { this.config = config; }
  analyze(tx: { wallet: string; amount_usd: number; token: string; action: string }): WhaleAlert | null {
    if (tx.amount_usd >= this.config.min_whale_usd) {
      return { wallet: tx.wallet, token: tx.token, action: tx.action, amount_usd: tx.amount_usd };
    }
    return null;
  }
}
