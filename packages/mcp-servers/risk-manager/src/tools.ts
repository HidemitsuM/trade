import type { RiskConfig } from '@trade/core';

interface TradeCheckRequest {
  agent: string;
  amount_usd: number;
  current_exposure: number;
}

interface TradeRecord {
  pnl: number;
}

interface TradeCheckResult {
  approved: boolean;
  reason?: string;
  circuit_breaker?: boolean;
}

export class RiskManager {
  private config: RiskConfig;
  private dailyPnl: number = 0;
  private peakBalance: number = 0;
  private currentBalance: number = 0;
  private circuitBreakerActive: boolean = false;

  constructor(config: RiskConfig) {
    this.config = config;
  }

  checkTrade(req: TradeCheckRequest): TradeCheckResult {
    if (this.circuitBreakerActive) {
      return { approved: false, reason: 'Circuit breaker is active', circuit_breaker: true };
    }

    if (req.amount_usd > this.config.max_single_trade_usd) {
      return {
        approved: false,
        reason: `Trade $${req.amount_usd} exceeds single trade limit $${this.config.max_single_trade_usd}`,
      };
    }

    if (req.current_exposure + req.amount_usd > this.config.max_total_exposure_usd) {
      return {
        approved: false,
        reason: `Total exposure $${req.current_exposure + req.amount_usd} would exceed limit $${this.config.max_total_exposure_usd}`,
      };
    }

    return { approved: true };
  }

  recordTrade(trade: TradeRecord): void {
    this.dailyPnl += trade.pnl;

    if (this.dailyPnl <= -this.config.circuit_breaker_loss_usd) {
      this.circuitBreakerActive = true;
    }
    if (this.dailyPnl <= -this.config.daily_loss_limit_usd) {
      this.circuitBreakerActive = true;
    }
  }

  setPeakBalance(amount: number): void {
    this.peakBalance = amount;
  }

  setCurrentBalance(amount: number): void {
    this.currentBalance = amount;
  }

  getDrawdownPct(): number {
    if (this.peakBalance === 0) return 0;
    return ((this.peakBalance - this.currentBalance) / this.peakBalance) * 100;
  }

  isDrawdownBreached(): boolean {
    return this.getDrawdownPct() > this.config.max_drawdown_pct;
  }

  isCircuitBreakerActive(): boolean {
    return this.circuitBreakerActive;
  }

  getDailyPnl(): number {
    return this.dailyPnl;
  }

  resetDaily(): void {
    this.dailyPnl = 0;
    this.circuitBreakerActive = false;
  }
}
