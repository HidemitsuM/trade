import { BaseAgent, logger, WalletManager } from '@trade/core';
import type { Signal, SignalType } from '@trade/core';
import { PortfolioGuardStrategy, type PortfolioGuardConfig } from './strategy.js';
import { randomUUID } from 'node:crypto';

export class PortfolioGuardAgent extends BaseAgent {
  private strategy: PortfolioGuardStrategy;
  private wallet: WalletManager | null = null;

  constructor(config: PortfolioGuardConfig) {
    super('portfolio-guard', { interval_ms: 5000 });
    this.strategy = new PortfolioGuardStrategy(config);
  }

  setWallet(wallet: WalletManager): void {
    this.wallet = wallet;
  }

  getSubscribedSignalTypes(): SignalType[] {
    return ['trade_executed', 'risk_breach'];
  }

  protected async tick(): Promise<void> {
    if (!this.simulation) return;

    // Use wallet for real portfolio data when available
    if (!this.isSimulation && this.wallet && this.mcpPool) {
      try {
        const balance = await this.wallet.getBalance();
        const solPrice = await this.mcpPool.callTool('coingecko', 'get_price', { coin_id: 'solana' }) as { price: number };
        const portfolio = {
          positions: [{
            token: 'SOL',
            entry_price: solPrice.price * 0.9,
            current_price: solPrice.price,
            allocation_pct: 100,
          }],
          total_value_usd: balance.nativeSol * solPrice.price,
          max_exposure_usd: balance.nativeSol * solPrice.price * 1.2,
        };

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
                  simulated: false,
                  timestamp: new Date().toISOString(),
                });
              }
            }
          }

          await this.wallet.syncState();
        }
        return;
      } catch (err) {
        logger.warn(`Agent ${this.name} wallet error, falling back to simulation`, { error: String(err) });
      }
    }

    // MCP real data path (fallback from wallet, or when no wallet configured)
    if (!this.isSimulation && this.mcpPool) {
      try {
        const walletAddress = process.env.WALLET_ADDRESS || '';
        if (walletAddress) {
          const balResult = await this.mcpPool.callTool('helius', 'get_account_balance', { address: walletAddress }) as { value: number };
          const solPrice = await this.mcpPool.callTool('coingecko', 'get_price', { coin_id: 'solana' }) as { price: number };
          const portfolio = {
            positions: [{ token: 'SOL', entry_price: solPrice.price * 0.9, current_price: solPrice.price, allocation_pct: 100 }],
            total_value_usd: balResult.value,
            max_exposure_usd: balResult.value * 1.2,
          };
          const action = this.strategy.evaluate(portfolio);
          if (action.stop_loss_triggered || action.rebalance_needed) {
            this.publishSignal('risk_breach', {
              stop_loss_triggered: action.stop_loss_triggered, rebalance_needed: action.rebalance_needed,
              tokens_to_sell: action.tokens_to_sell, total_value_usd: portfolio.total_value_usd,
            }, action.stop_loss_triggered ? 0.95 : 0.7);
            if (this.db) {
              for (const token of action.tokens_to_sell) {
                const pos = portfolio.positions.find((p) => p.token === token);
                if (pos) {
                  this.db.insertTrade({
                    id: randomUUID(), agent: this.name, pair: `${token}/USDT`, side: 'sell',
                    entry_price: pos.entry_price, exit_price: pos.current_price, quantity: 1,
                    pnl: pos.current_price - pos.entry_price, fee: pos.current_price * 0.001,
                    chain: 'solana', tx_hash: null, simulated: false, timestamp: new Date().toISOString(),
                  });
                }
              }
            }
          }
          return;
        }
      } catch (err) {
        logger.warn(`Agent ${this.name} MCP error, falling back to simulation`, { error: String(err) });
      }
    }

    // Simulation path
    const portfolio = this.simulation.generatePortfolioState();
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
              simulated: true,
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
