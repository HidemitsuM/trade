import { BaseAgent, logger } from '@trade/core';
import type { Signal, SignalType } from '@trade/core';
import { LiquidityHunterStrategy, type LiquidityHunterConfig } from './strategy.js';

const TOKENS = ['SOL', 'ETH', 'BTC', 'BNB', 'MATIC', 'AVAX', 'DOGE', 'PEPE'];

export class LiquidityHunterAgent extends BaseAgent {
  private strategy: LiquidityHunterStrategy;
  private previousQuotes: Map<string, number> = new Map();
  constructor(config: LiquidityHunterConfig) {
    super('liquidity-hunter', { interval_ms: 5000 });
    this.strategy = new LiquidityHunterStrategy(config);
  }

  private async fetchRealLiquidity(): Promise<{ token: string; previous_liquidity: number; current_liquidity: number }> {
    const token = TOKENS[Math.floor(Math.random() * TOKENS.length)];
    // Use CoinGecko token volume as liquidity proxy
    const res = await this.mcpPool!.callTool('coingecko', 'get_token_info', { coin_id: token.toLowerCase() }) as { price: number; volume_24h: number };
    const previous = this.previousQuotes.get(token) ?? res.volume_24h;
    this.previousQuotes.set(token, res.volume_24h);
    return { token, previous_liquidity: previous, current_liquidity: res.volume_24h };
  }

  protected async tick(): Promise<void> {
    if (!this.simulation) return;
    let data: { token: string; previous_liquidity: number; current_liquidity: number };

    if (this.isSimulation || !this.mcpPool) {
      data = this.simulation.generateLiquidityData();
    } else {
      try {
        data = await this.fetchRealLiquidity();
      } catch (err) {
        logger.warn(`Agent ${this.name} MCP error, falling back to simulation`, { error: String(err) });
        data = this.simulation.generateLiquidityData();
      }
    }

    const alert = this.strategy.analyze(data);
    if (alert) {
      this.publishSignal('liquidity_change', {
        token: alert.token,
        previous_liquidity: alert.previous_liquidity,
        current_liquidity: alert.current_liquidity,
        change_pct: alert.change_pct,
      }, Math.min(0.95, 0.4 + Math.abs(alert.change_pct) / 50));
    }
  }

  protected async onSignal(signal: Signal): Promise<void> {}
}
