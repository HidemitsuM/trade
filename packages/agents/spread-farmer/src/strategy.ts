export interface SpreadFarmerConfig { min_spread_pct: number; max_positions: number; }
export interface SpreadEvalResult { should_trade: boolean; spread_pct: number; }

export class SpreadFarmerStrategy {
  private config: SpreadFarmerConfig;
  constructor(config: SpreadFarmerConfig) { this.config = config; }
  evaluate(orderbook: { market: string; best_bid: number; best_ask: number; quantity: number }): SpreadEvalResult {
    const spread_pct = (orderbook.best_bid + orderbook.best_ask) > 0 ? ((orderbook.best_ask - orderbook.best_bid) / (orderbook.best_bid + orderbook.best_ask)) * 100 : 0;
    return { should_trade: spread_pct > this.config.min_spread_pct + 1e-9, spread_pct };
  }
}
