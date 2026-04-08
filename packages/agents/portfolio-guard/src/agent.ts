import { BaseAgent, logger } from '@trade/core';
import type { Signal, SignalType } from '@trade/core';
import { PortfolioGuardStrategy, type PortfolioGuardConfig } from './strategy.js';
import { randomUUID } from 'node:crypto';

export class PortfolioGuardAgent extends BaseAgent {
  private strategy: PortfolioGuardStrategy;
  private walletAddress: string;
  constructor(config: PortfolioGuardConfig) {
    super('portfolio-guard', { interval_ms: 5000 });
    this.strategy = new PortfolioGuardStrategy(config);
    this.walletAddress = process.env.WALLET_ADDRESS || '';
  }

  getSubscribedSignalTypes(): SignalType[] {
    return ['trade_executed', 'risk_breach'];
  }

  private async fetchRealPortfolio(): Promise<{ positions: { token: string; entry_price: number; current_price: number; allocation_pct: number }[]; total_value_usd: number; max_exposure_usd: number }> {
    if (!this.walletAddress) throw new Error('WALLET_ADDRESS not set');

    const balance = await this.mcpPool!.callTool('helius', 'get_account_balance', { address: this.walletAddress }) as { lamports: number; value: number };
    const solBalance = balance.value;
    const solPrice = await this.mcpPool!.callTool('coingecko', 'get_price', { coin_id: 'solana' }) as { price: number };

    return {
      positions: [{
        token: 'SOL',
        entry_price: solPrice.price * 0.9,
        current_price: solPrice.price,
        allocation_pct: 100,
      }],
      total_value_usd: solBalance,
      max_exposure_usd: solBalance * 1.2,
    };
  }

  protected async tick(): Promise<void> {
    if (!this.simulation) return;
    let portfolio: { positions: { token: string; entry_price: number; current_price: number; allocation_pct: number }[]; total_value_usd: number; max_exposure_usd: number };

    if (this.isSimulation || !this.mcpPool) {
      portfolio = this.simulation.generatePortfolioState();
    } else {
      try {
        portfolio = await this.fetchRealPortfolio();
      } catch (err) {
        logger.warn(`Agent ${this.name} MCP error, falling back to simulation`, { error: String(err) });
        portfolio = this.simulation.generatePortfolioState();
      }
    }

    const action = this.strategy.evaluate(portfolio);

    if (action.stop_loss_triggered || action.rebalance_needed) {
      this.publishSignal('risk_breach', {
        stop_loss_triggered: action.stop_loss_triggered,
        rebalance_needed: action.rebalance_needed,
        tokens_to_sell: action.tokens_to_sell,
        total_value_usd: portfolio.total_value_usd,
      }, action.stop_loss_triggered ? 0.95 : 0.7);

      if (this.db) {
        for (const token of action.tokens_to_sell) {
          const pos = portfolio.positions.find((p) => p.token === token);
          if (pos) {
            this.db.insertTrade({
              id: randomUUID(),
              agent: this.name,
              pair: `${token}/USDT`,
              side: 'sell',
              entry_price: pos.entry_price,
              exit_price: pos.current_price,
              quantity: 1,
              pnl: pos.current_price - pos.entry_price,
              fee: pos.current_price * 0.001,
              chain: 'solana',
              tx_hash: null,
              simulated: this.isSimulation,
              timestamp: new Date().toISOString(),
            });
          }
        }
      }
    }
  }

  protected async onSignal(signal: Signal): Promise<void> {
    if (signal.signal_type === 'trade_executed') {
      this.publishSignal('risk_breach', { action: 'monitoring', data: signal.data }, 1.0);
    }
  }
}
