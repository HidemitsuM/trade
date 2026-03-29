import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../src/db.js';

describe('Database', () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.initialize();
  });

  afterEach(() => {
    db.close();
  });

  describe('trade_log', () => {
    it('inserts and retrieves a trade', () => {
      db.insertTrade({
        id: 'trade-1',
        agent: 'arb-scanner',
        pair: 'SOL/USDT',
        side: 'buy',
        entry_price: 150.5,
        exit_price: null,
        quantity: 10,
        pnl: null,
        fee: 0.45,
        chain: 'solana',
        tx_hash: null,
        simulated: true,
        timestamp: new Date().toISOString(),
      });

      const trades = db.getTradesByAgent('arb-scanner');
      expect(trades).toHaveLength(1);
      expect(trades[0].pair).toBe('SOL/USDT');
      expect(trades[0].side).toBe('buy');
    });
  });

  describe('signal_log', () => {
    it('inserts and retrieves a signal', () => {
      db.insertSignal({
        id: 'sig-1',
        source_agent: 'whale-tracker',
        signal_type: 'whale_move',
        data: { wallet: 'abc123', amount: 50000 },
        confidence: 0.9,
        timestamp: new Date().toISOString(),
      });

      const signals = db.getSignalsByType('whale_move');
      expect(signals).toHaveLength(1);
      expect(signals[0].source_agent).toBe('whale-tracker');
      expect((signals[0].data as { wallet: string }).wallet).toBe('abc123');
    });
  });

  describe('agent_state', () => {
    it('upserts agent state', () => {
      db.upsertAgentState({
        id: 'agent-1',
        agent_name: 'arb-scanner',
        status: 'running',
        config: { min_profit_usd: 5 },
        last_heartbeat: new Date().toISOString(),
        total_pnl: 0,
        trade_count: 0,
      });

      const state = db.getAgentState('arb-scanner');
      expect(state).toBeDefined();
      expect(state!.status).toBe('running');
      expect(state!.agent_name).toBe('arb-scanner');
    });

    it('updates existing agent state', () => {
      const ts = new Date().toISOString();
      db.upsertAgentState({
        id: 'agent-1',
        agent_name: 'arb-scanner',
        status: 'running',
        config: {},
        last_heartbeat: ts,
        total_pnl: 100,
        trade_count: 5,
      });
      db.upsertAgentState({
        id: 'agent-1',
        agent_name: 'arb-scanner',
        status: 'stopped',
        config: {},
        last_heartbeat: ts,
        total_pnl: 200,
        trade_count: 5,
      });

      const state = db.getAgentState('arb-scanner');
      expect(state!.status).toBe('stopped');
      expect(state!.total_pnl).toBe(200);
    });
  });

  describe('pnl calculation', () => {
    it('calculates total PnL for an agent', () => {
      db.insertTrade({
        id: 't1', agent: 'arb-scanner', pair: 'SOL/USDT', side: 'buy',
        entry_price: 100, exit_price: 110, quantity: 1, pnl: 10, fee: 0.3,
        chain: 'solana', tx_hash: null, simulated: true,
        timestamp: new Date().toISOString(),
      });
      db.insertTrade({
        id: 't2', agent: 'arb-scanner', pair: 'ETH/USDT', side: 'sell',
        entry_price: 200, exit_price: 195, quantity: 1, pnl: -5, fee: 0.3,
        chain: 'solana', tx_hash: null, simulated: true,
        timestamp: new Date().toISOString(),
      });

      const pnl = db.getAgentPnl('arb-scanner');
      expect(pnl).toBe(5);
    });
  });

  describe('risk_state', () => {
    it('upserts and retrieves risk state', () => {
      db.upsertRiskState({
        metric: 'total_exposure',
        value: 3500,
        threshold: 5000,
        breached: false,
        timestamp: new Date().toISOString(),
      });

      const states = db.getRiskStates();
      expect(states).toHaveLength(1);
      expect(states[0].value).toBe(3500);
    });
  });
});
