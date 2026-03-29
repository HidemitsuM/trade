export interface PortfolioGuardConfig { stop_loss_pct: number; rebalance_threshold_pct: number; }
export interface Position { token: string; entry_price: number; current_price: number; allocation_pct: number; }
export interface GuardAction { stop_loss_triggered: boolean; rebalance_needed: boolean; tokens_to_sell: string[]; }

export class PortfolioGuardStrategy {
  private config: PortfolioGuardConfig;
  constructor(config: PortfolioGuardConfig) { this.config = config; }

  evaluate(portfolio: { positions: Position[]; total_value_usd: number; max_exposure_usd: number }): GuardAction {
    const action: GuardAction = { stop_loss_triggered: false, rebalance_needed: false, tokens_to_sell: [] };
    const max_allocation = 100 / portfolio.positions.length;

    for (const pos of portfolio.positions) {
      const pnl_pct = ((pos.current_price - pos.entry_price) / pos.entry_price) * 100;
      if (pnl_pct <= -this.config.stop_loss_pct) {
        action.stop_loss_triggered = true;
        action.tokens_to_sell.push(pos.token);
      }
      if (pos.allocation_pct > max_allocation + this.config.rebalance_threshold_pct) {
        action.rebalance_needed = true;
        if (!action.tokens_to_sell.includes(pos.token)) {
          action.tokens_to_sell.push(pos.token);
        }
      }
    }
    return action;
  }
}
