// --- Trade types ---
export type TradeSide = 'buy' | 'sell';

export interface TradeLog {
  id: string;
  agent: string;
  pair: string;
  side: TradeSide;
  entry_price: number;
  exit_price: number | null;
  quantity: number;
  pnl: number | null;
  fee: number;
  chain: string;
  tx_hash: string | null;
  simulated: boolean;
  timestamp: string;
}

// --- Signal types ---
export type SignalType =
  | 'price_gap'
  | 'new_token'
  | 'whale_move'
  | 'liquidity_change'
  | 'sentiment_shift'
  | 'spread_opportunity'
  | 'risk_breach'
  | 'trade_executed';

export interface Signal {
  id: string;
  source_agent: string;
  signal_type: SignalType;
  data: Record<string, unknown>;
  confidence: number;
  timestamp: string;
}

// --- Agent types ---
export type AgentStatus = 'idle' | 'running' | 'error' | 'stopped';

export interface AgentState {
  id: string;
  agent_name: string;
  status: AgentStatus;
  config: Record<string, unknown>;
  last_heartbeat: string | null;
  total_pnl: number;
  trade_count: number;
}

// --- Wallet types ---
export interface WalletState {
  id: string;
  chain: string;
  address: string;
  balances: Record<string, number>;
  updated_at: string;
}

// --- Risk types ---
export type RiskMetric =
  | 'total_exposure'
  | 'single_trade'
  | 'daily_loss'
  | 'drawdown'
  | 'circuit_breaker';

export interface RiskState {
  metric: RiskMetric;
  value: number;
  threshold: number;
  breached: boolean;
  timestamp: string;
}

// --- Config types ---
export interface RiskConfig {
  max_total_exposure_usd: number;
  max_single_trade_usd: number;
  max_drawdown_pct: number;
  circuit_breaker_loss_usd: number;
  daily_loss_limit_usd: number;
}

export interface SimulationConfig {
  enabled: boolean;
  slippage_pct: number;
  fee_pct: number;
}

export interface OrchestratorConfig {
  max_concurrent_agents: number;
  signal_timeout_ms: number;
  heartbeat_interval_ms: number;
}

export interface AppConfig {
  orchestrator: OrchestratorConfig;
  risk: RiskConfig;
  simulation: SimulationConfig;
}
