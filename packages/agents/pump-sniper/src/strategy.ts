export interface PumpSniperConfig { max_position_usd: number; max_open_positions: number; }
export interface PumpEvalResult { should_buy: boolean; reason?: string; }

export class PumpSniperStrategy {
  private config: PumpSniperConfig;
  constructor(config: PumpSniperConfig) { this.config = config; }
  evaluate(token: { token: string; liquidity_usd: number; social_score: number; red_flags: string[] }): PumpEvalResult {
    if (token.red_flags.length > 0) return { should_buy: false, reason: `Red flags: ${token.red_flags.join(', ')}` };
    if (token.liquidity_usd < 5000) return { should_buy: false, reason: `Low liquidity: $${token.liquidity_usd}` };
    if (token.social_score < 0.5) return { should_buy: false, reason: `Low social score: ${token.social_score}` };
    return { should_buy: true };
  }
}
