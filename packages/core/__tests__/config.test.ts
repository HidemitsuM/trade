import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('loads default config from yaml', async () => {
    const config = await loadConfig('config/default.yaml');
    expect(config.risk.max_total_exposure_usd).toBe(5000);
    expect(config.risk.max_single_trade_usd).toBe(500);
    expect(config.simulation.enabled).toBe(true);
    expect(config.orchestrator.max_concurrent_agents).toBe(8);
  });

  it('throws on missing file', async () => {
    await expect(loadConfig('nonexistent.yaml')).rejects.toThrow();
  });
});
