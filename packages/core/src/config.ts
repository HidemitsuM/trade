import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { AppConfig } from './types.js';

export async function loadConfig(configPath: string): Promise<AppConfig> {
  const fullPath = resolve(configPath);
  const raw = readFileSync(fullPath, 'utf-8');
  const parsed = parseYaml(raw);

  if (!parsed.orchestrator || !parsed.risk || !parsed.simulation) {
    throw new Error('Invalid config: missing required sections (orchestrator, risk, simulation)');
  }

  return {
    orchestrator: {
      max_concurrent_agents: parsed.orchestrator.max_concurrent_agents,
      signal_timeout_ms: parsed.orchestrator.signal_timeout_ms,
      heartbeat_interval_ms: parsed.orchestrator.heartbeat_interval_ms,
    },
    risk: {
      max_total_exposure_usd: parsed.risk.max_total_exposure_usd,
      max_single_trade_usd: parsed.risk.max_single_trade_usd,
      max_drawdown_pct: parsed.risk.max_drawdown_pct,
      circuit_breaker_loss_usd: parsed.risk.circuit_breaker_loss_usd,
      daily_loss_limit_usd: parsed.risk.daily_loss_limit_usd,
    },
    simulation: {
      enabled: parsed.simulation.enabled,
      slippage_pct: parsed.simulation.slippage_pct,
      fee_pct: parsed.simulation.fee_pct,
    },
  };
}
