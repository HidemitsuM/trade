import { BaseAgent, logger } from '@trade/core';
import type { Signal, SignalType } from '@trade/core';
import { PumpSniperStrategy, type PumpSniperConfig } from './strategy.js';
import { randomUUID } from 'node:crypto';

export class PumpSniperAgent extends BaseAgent {
  private strategy: PumpSniperStrategy;
  private agentConfig: PumpSniperConfig;
  constructor(config: PumpSniperConfig) {
    super('pump-sniper', { interval_ms: 5000 });
    this.agentConfig = config;
    this.strategy = new PumpSniperStrategy(config);
  }

  getSubscribedSignalTypes(): SignalType[] {
    return ['new_token'];
  }

  private async fetchTrendingTokens(): Promise<{ token: string; liquidity_usd: number; social_score: number; red_flags: string[] }[]> {
    const trending = await this.mcpPool!.callTool('coingecko', 'get_trending', {}) as Array<{ id: string; name: string; symbol: string; market_cap_rank: number }>;
    return trending.map((coin, i) => ({
      token: coin.symbol,
      liquidity_usd: Math.max(1000, (101 - coin.market_cap_rank) * 5000),
      social_score: Math.min(0.95, 0.3 + (trending.length - i) / trending.length * 0.6),
      red_flags: coin.market_cap_rank > 500 ? ['no_audit'] : [],
    }));
  }

  protected async tick(): Promise<void> {
    if (!this.simulation) return;
    let tokens: { token: string; liquidity_usd: number; social_score: number; red_flags: string[] }[];

    if (this.isSimulation || !this.mcpPool) {
      tokens = [this.simulation.generateNewToken()];
    } else {
      try {
        tokens = await this.fetchTrendingTokens();
      } catch (err) {
        logger.warn(`Agent ${this.name} MCP error, falling back to simulation`, { error: String(err) });
        tokens = [this.simulation.generateNewToken()];
      }
    }

    for (const tokenData of tokens) {
      const decision = this.strategy.evaluate(tokenData);
      if (decision.should_buy) {
        this.publishSignal('new_token', {
          token: tokenData.token,
          liquidity_usd: tokenData.liquidity_usd,
          social_score: tokenData.social_score,
        }, tokenData.social_score);

        if (this.db) {
          const entryPrice = Math.max(0.001, tokenData.liquidity_usd / 1000000);
          this.db.insertTrade({
            id: randomUUID(),
            agent: this.name,
            pair: `${tokenData.token}/USDT`,
            side: 'buy',
            entry_price: entryPrice,
            exit_price: null,
            quantity: Math.round(this.agentConfig.max_position_usd / entryPrice),
            pnl: null,
            fee: entryPrice * 0.001,
            chain: 'solana',
            tx_hash: null,
            simulated: this.isSimulation,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
  }

  protected async onSignal(signal: Signal): Promise<void> {
    if (signal.signal_type === 'new_token') {
      this.publishSignal('risk_breach', { action: 'evaluating_new_token', data: signal.data }, signal.confidence);
    }
  }
}
