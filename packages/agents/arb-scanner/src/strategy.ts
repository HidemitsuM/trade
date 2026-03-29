export interface ArbConfig { min_profit_usd: number; chains: string[]; }
export interface ArbOpportunity { pair: string; buyPrice: number; sellPrice: number; quantity: number; profit: number; }

export class ArbStrategy {
  private config: ArbConfig;
  constructor(config: ArbConfig) { this.config = config; }
  analyze(prices: { pair: string; buyPrice: number; sellPrice: number; quantity: number }): ArbOpportunity | null {
    const profit = (prices.sellPrice - prices.buyPrice) * prices.quantity;
    if (profit >= this.config.min_profit_usd) {
      return { pair: prices.pair, buyPrice: prices.buyPrice, sellPrice: prices.sellPrice, quantity: prices.quantity, profit };
    }
    return null;
  }
}
