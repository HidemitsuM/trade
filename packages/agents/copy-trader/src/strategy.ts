export interface CopyTraderConfig { max_copy_usd: number; copy_delay_ms: number; }
export interface CopyEvalResult { should_copy: boolean; copy_amount_usd: number; }

export class CopyTraderStrategy {
  private config: CopyTraderConfig;
  constructor(config: CopyTraderConfig) { this.config = config; }
  evaluate(signal: { whale_wallet: string; action: string; token: string; amount_usd: number }): CopyEvalResult {
    if (signal.action !== 'buy') return { should_copy: false, copy_amount_usd: 0 };
    return { should_copy: true, copy_amount_usd: Math.min(this.config.max_copy_usd, signal.amount_usd * 0.01) };
  }
}
