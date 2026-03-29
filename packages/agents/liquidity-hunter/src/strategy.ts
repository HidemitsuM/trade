export interface LiquidityHunterConfig { min_liquidity_change_pct: number; }
export interface LiquidityAlert { token: string; previous_liquidity: number; current_liquidity: number; change_pct: number; }

export class LiquidityHunterStrategy {
  private config: LiquidityHunterConfig;
  constructor(config: LiquidityHunterConfig) { this.config = config; }
  analyze(data: { token: string; previous_liquidity: number; current_liquidity: number }): LiquidityAlert | null {
    if (data.previous_liquidity === 0) return null;
    const change_pct = ((data.current_liquidity - data.previous_liquidity) / data.previous_liquidity) * 100;
    if (Math.abs(change_pct) >= this.config.min_liquidity_change_pct) {
      return { token: data.token, previous_liquidity: data.previous_liquidity, current_liquidity: data.current_liquidity, change_pct };
    }
    return null;
  }
}
