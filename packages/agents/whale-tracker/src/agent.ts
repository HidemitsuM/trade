import { BaseAgent, logger } from '@trade/core';
import type { Signal, SignalType } from '@trade/core';
import { WhaleTrackerStrategy, type WhaleTrackerConfig } from './strategy.js';

export class WhaleTrackerAgent extends BaseAgent {
  private strategy: WhaleTrackerStrategy;
  constructor(config: WhaleTrackerConfig) {
    super('whale-tracker', { interval_ms: 5000 });
    this.strategy = new WhaleTrackerStrategy(config);
  }

  getSubscribedSignalTypes(): SignalType[] {
    return [];
  }

  protected async tick(): Promise<void> {
    if (!this.simulation) return;
    // Whale tracking requires real-time blockchain monitoring (WebSocket/subscription)
    // not available via current MCP request/response tools — always simulation
    if (!this.isSimulation && this.mcpPool) {
      logger.debug(`Agent ${this.name} using simulation (no real-time whale tracking MCP tool)`);
    }

    const tx = this.simulation.generateWhaleTx();
    const alert = this.strategy.analyze(tx);
    if (alert) {
      this.publishSignal('whale_move', {
        wallet: alert.wallet,
        token: alert.token,
        action: alert.action,
        amount_usd: alert.amount_usd,
      }, Math.min(0.99, 0.5 + alert.amount_usd / 200000));
    }
  }

  protected async onSignal(signal: Signal): Promise<void> {}
}
