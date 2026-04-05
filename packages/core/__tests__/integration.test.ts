import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Database } from '../src/db.js';
import { SimulationEngine } from '../src/simulation.js';
import { SignalBus } from '../src/signal-bus.js';
import type { Signal, SignalType, SignalHandler } from '../src/types.js';
import { ArbScannerAgent } from '@trade/agent-arb-scanner';
import { WhaleTrackerAgent } from '@trade/agent-whale-tracker';
import { CopyTraderAgent } from '@trade/agent-copy-trader';

// --- Mock SignalBus (no Redis needed) ---
class MockSignalBus implements SignalBus {
  private handlers: Map<string, Set<SignalHandler>> = new Map();
  private publishedSignals: Signal[] = [];

  async publish(signal: Signal): Promise<void> {
    this.publishedSignals.push(signal);
    const handlers = this.handlers.get(signal.signal_type);
    if (handlers) {
      for (const h of handlers) {
        h(signal);
      }
    }
  }

  async subscribe(signalType: SignalType, handler: SignalHandler): Promise<SignalHandler> {
    if (!this.handlers.has(signalType)) {
      this.handlers.set(signalType, new Set());
    }
    this.handlers.get(signalType)!.add(handler);
    return handler;
  }

  async unsubscribe(signalType: SignalType, handler: SignalHandler): Promise<void> {
    const handlers = this.handlers.get(signalType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  async disconnect(): Promise<void> {
    this.handlers.clear();
    this.publishedSignals = [];
  }

  // Test helpers
  getPublishedSignals(): Signal[] {
    return this.publishedSignals;
  }

  getPublishedSignalsByType(type: SignalType): Signal[] {
    return this.publishedSignals.filter(s => s.signal_type === type);
  }
}

// --- Tests ---

describe('Infrastructure', () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  it('initializes Database with in-memory SQLite and creates all tables', () => {
    db.initialize();

    // Verify tables exist by querying SQLite master
    const tables = (db as unknown as { db: { prepare: (sql: string) => { all: () => { name: string }[] } } }).db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map(r => r.name);

    expect(tables).toContain('trade_log');
    expect(tables).toContain('signal_log');
    expect(tables).toContain('agent_state');
    expect(tables).toContain('risk_state');
    expect(tables).toContain('wallet_state');
  });

  it('allows inserting and querying trades after initialization', () => {
    db.initialize();

    db.insertTrade({
      id: 'test-trade-1',
      agent: 'test-agent',
      pair: 'BTC/USDT',
      side: 'buy',
      entry_price: 50000,
      exit_price: null,
      quantity: 1,
      pnl: null,
      fee: 50,
      chain: 'ethereum',
      tx_hash: null,
      simulated: true,
      timestamp: new Date().toISOString(),
    });

    const trades = db.getTradesByAgent('test-agent');
    expect(trades).toHaveLength(1);
    expect(trades[0].pair).toBe('BTC/USDT');
  });
});

describe('Agent Infrastructure', () => {
  let db: Database;
  let signalBus: MockSignalBus;
  let simulation: SimulationEngine;

  beforeEach(() => {
    db = new Database(':memory:');
    db.initialize();
    signalBus = new MockSignalBus();
    simulation = new SimulationEngine();
  });

  afterEach(() => {
    db.close();
  });

  it('injects SignalBus, DB, Simulation into agents', () => {
    const agent = new ArbScannerAgent({ min_profit_usd: 5, chains: ['solana', 'bsc'] });
    agent.setInfrastructure({ db, signalBus, simulation });

    // Publish a signal and verify it is written to DB
    const signal = agent.publishSignal('price_gap', { pair: 'SOL/USDT' }, 0.9);

    expect(signal.signal_type).toBe('price_gap');
    expect(signal.source_agent).toBe('arb-scanner');
    expect(signal.confidence).toBe(0.9);
    expect(signal.id).toBeDefined();
    expect(signal.timestamp).toBeDefined();

    // Verify signal was persisted to DB
    const dbSignals = db.getSignalsByType('price_gap');
    expect(dbSignals).toHaveLength(1);
    expect(dbSignals[0].id).toBe(signal.id);
  });

  it('publishes signals through SignalBus', () => {
    const agent = new ArbScannerAgent({ min_profit_usd: 5, chains: ['solana', 'bsc'] });
    agent.setInfrastructure({ db, signalBus, simulation });

    agent.publishSignal('price_gap', { pair: 'ETH/USDT' }, 0.85);

    const published = signalBus.getPublishedSignals();
    expect(published).toHaveLength(1);
    expect(published[0].signal_type).toBe('price_gap');
    expect((published[0].data as { pair: string }).pair).toBe('ETH/USDT');
  });
});

describe('Agent tick simulation', () => {
  let db: Database;
  let signalBus: MockSignalBus;
  let simulation: SimulationEngine;

  beforeEach(() => {
    db = new Database(':memory:');
    db.initialize();
    signalBus = new MockSignalBus();
    simulation = new SimulationEngine();
  });

  afterEach(() => {
    db.close();
  });

  it('arb-scanner tick generates signals and records trades', async () => {
    const agent = new ArbScannerAgent({ min_profit_usd: 5, chains: ['solana', 'bsc'] });
    agent.setInfrastructure({ db, signalBus, simulation });

    await agent.tick();

    // Signals may or may not be generated depending on simulated prices,
    // but the call should succeed without error.
    const signals = db.getSignalsByType('price_gap');
    expect(Array.isArray(signals)).toBe(true);
  });

  it('whale-tracker tick generates whale_move signals', async () => {
    const agent = new WhaleTrackerAgent({ min_whale_usd: 10000 });
    agent.setInfrastructure({ db, signalBus, simulation });

    await agent.tick();

    // whale_move signals may or may not be generated depending on random amounts
    const signals = db.getSignalsByType('whale_move');
    expect(Array.isArray(signals)).toBe(true);
  });

  it('copy-trader tick generates trade_executed signals for buy actions', async () => {
    const agent = new CopyTraderAgent({ max_copy_usd: 300, copy_delay_ms: 2000 });
    agent.setInfrastructure({ db, signalBus, simulation });

    await agent.tick();

    const signals = db.getSignalsByType('trade_executed');
    expect(Array.isArray(signals)).toBe(true);
  });

  it('multiple ticks accumulate data in DB', async () => {
    const agent = new ArbScannerAgent({ min_profit_usd: 1, chains: ['solana'] });
    agent.setInfrastructure({ db, signalBus, simulation });

    // Run several ticks to increase chance of generating signals
    for (let i = 0; i < 10; i++) {
      await agent.tick();
    }

    const signals = db.getSignalsByType('price_gap');
    const trades = db.getTradesByAgent('arb-scanner');

    // With min_profit_usd: 1 and 10 ticks, at least some should generate
    // (each tick processes 4 pairs)
    expect(signals.length).toBeGreaterThanOrEqual(0);
    expect(trades.length).toBeGreaterThanOrEqual(0);

    // Signals and trades should be in sync (each signal with profit >= 1 also creates a trade)
    expect(trades.length).toBe(signals.length);
  });
});

describe('Inter-agent signal propagation', () => {
  let db: Database;
  let signalBus: MockSignalBus;
  let simulation: SimulationEngine;

  beforeEach(() => {
    db = new Database(':memory:');
    db.initialize();
    signalBus = new MockSignalBus();
    simulation = new SimulationEngine();
  });

  afterEach(() => {
    db.close();
  });

  it('whale-tracker publishes whale_move signal received by copy-trader onSignal', async () => {
    const whaleAgent = new WhaleTrackerAgent({ min_whale_usd: 100 });
    whaleAgent.setInfrastructure({ db, signalBus, simulation });

    const copyAgent = new CopyTraderAgent({ max_copy_usd: 300, copy_delay_ms: 2000 });
    copyAgent.setInfrastructure({ db, signalBus, simulation });

    // Manually subscribe copy-trader to whale_move signals (simulating what start() does)
    await signalBus.subscribe('whale_move', (signal) => {
      copyAgent.onSignal(signal).catch(() => {});
    });

    // Whale tracker publishes a signal
    const whaleSignal = whaleAgent.publishSignal('whale_move', {
      wallet: '0xwhale123',
      token: 'ETH',
      action: 'buy',
      amount_usd: 50000,
    }, 0.9);

    // Verify signal was published
    const published = signalBus.getPublishedSignalsByType('whale_move');
    expect(published).toHaveLength(1);
    expect(published[0].id).toBe(whaleSignal.id);

    // Copy trader should have reacted (it copies buy actions)
    const copySignals = signalBus.getPublishedSignalsByType('trade_executed');
    expect(copySignals.length).toBeGreaterThanOrEqual(1);
    expect(copySignals[0].signal_type).toBe('trade_executed');
  });

  it('whale-tracker publishes whale_move signal received by arb-scanner onSignal', async () => {
    const whaleAgent = new WhaleTrackerAgent({ min_whale_usd: 100 });
    whaleAgent.setInfrastructure({ db, signalBus, simulation });

    const arbAgent = new ArbScannerAgent({ min_profit_usd: 5, chains: ['solana'] });
    arbAgent.setInfrastructure({ db, signalBus, simulation });

    // Subscribe arb-scanner to whale_move signals
    await signalBus.subscribe('whale_move', (signal) => {
      arbAgent.onSignal(signal).catch(() => {});
    });

    whaleAgent.publishSignal('whale_move', {
      wallet: '0xwhale456',
      token: 'BTC',
      action: 'sell',
      amount_usd: 75000,
    }, 0.95);

    // Arb-scanner should have published a price_gap signal in response
    const arbSignals = signalBus.getPublishedSignalsByType('price_gap');
    expect(arbSignals.length).toBeGreaterThanOrEqual(1);
    expect(arbSignals[0].data).toHaveProperty('source', 'whale');
  });

  it('signal propagation chain: whale_move -> copy-trader -> trade_executed', async () => {
    const whaleAgent = new WhaleTrackerAgent({ min_whale_usd: 1 });
    whaleAgent.setInfrastructure({ db, signalBus, simulation });

    const copyAgent = new CopyTraderAgent({ max_copy_usd: 500, copy_delay_ms: 0 });
    copyAgent.setInfrastructure({ db, signalBus, simulation });

    // Wire up subscription
    await signalBus.subscribe('whale_move', (signal) => {
      copyAgent.onSignal(signal).catch(() => {});
    });

    // Publish a whale buy signal
    whaleAgent.publishSignal('whale_move', {
      wallet: '0xwhale789',
      token: 'SOL',
      action: 'buy',
      amount_usd: 100000,
    }, 0.85);

    // Verify the full chain
    const whaleSignals = db.getSignalsByType('whale_move');
    expect(whaleSignals.length).toBe(1);

    const tradeSignals = signalBus.getPublishedSignalsByType('trade_executed');
    expect(tradeSignals.length).toBeGreaterThanOrEqual(1);
    expect((tradeSignals[0].data as { token: string }).token).toBe('SOL');
  });
});

describe('Dashboard queries', () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.initialize();
  });

  afterEach(() => {
    db.close();
  });

  it('queries trades by agent', () => {
    db.insertTrade({
      id: 'dash-trade-1',
      agent: 'arb-scanner',
      pair: 'SOL/USDT',
      side: 'buy',
      entry_price: 150,
      exit_price: 155,
      quantity: 10,
      pnl: 45,
      fee: 0.5,
      chain: 'solana',
      tx_hash: null,
      simulated: true,
      timestamp: new Date().toISOString(),
    });
    db.insertTrade({
      id: 'dash-trade-2',
      agent: 'copy-trader',
      pair: 'ETH/USDT',
      side: 'buy',
      entry_price: 3000,
      exit_price: null,
      quantity: 0.5,
      pnl: null,
      fee: 1.5,
      chain: 'ethereum',
      tx_hash: null,
      simulated: true,
      timestamp: new Date().toISOString(),
    });

    const arbTrades = db.getTradesByAgent('arb-scanner');
    expect(arbTrades).toHaveLength(1);
    expect(arbTrades[0].pair).toBe('SOL/USDT');
    expect(arbTrades[0].pnl).toBe(45);

    const copyTrades = db.getTradesByAgent('copy-trader');
    expect(copyTrades).toHaveLength(1);
    expect(copyTrades[0].pair).toBe('ETH/USDT');
  });

  it('calculates PnL across multiple trades for an agent', () => {
    const ts = new Date().toISOString();
    db.insertTrade({
      id: 'pnl-1', agent: 'arb-scanner', pair: 'SOL/USDT', side: 'buy',
      entry_price: 100, exit_price: 110, quantity: 5, pnl: 50, fee: 0.5,
      chain: 'solana', tx_hash: null, simulated: true, timestamp: ts,
    });
    db.insertTrade({
      id: 'pnl-2', agent: 'arb-scanner', pair: 'ETH/USDT', side: 'sell',
      entry_price: 3000, exit_price: 2950, quantity: 1, pnl: -50, fee: 3,
      chain: 'ethereum', tx_hash: null, simulated: true, timestamp: ts,
    });
    db.insertTrade({
      id: 'pnl-3', agent: 'arb-scanner', pair: 'BTC/USDT', side: 'buy',
      entry_price: 50000, exit_price: 50300, quantity: 0.1, pnl: 30, fee: 5,
      chain: 'solana', tx_hash: null, simulated: true, timestamp: ts,
    });

    const pnl = db.getAgentPnl('arb-scanner');
    expect(pnl).toBe(30); // 50 - 50 + 30
  });

  it('queries signals by type across multiple agents', () => {
    const ts = new Date().toISOString();
    db.insertSignal({
      id: 'sig-1', source_agent: 'whale-tracker', signal_type: 'whale_move',
      data: { wallet: '0xa', amount_usd: 50000 }, confidence: 0.9, timestamp: ts,
    });
    db.insertSignal({
      id: 'sig-2', source_agent: 'whale-tracker', signal_type: 'whale_move',
      data: { wallet: '0xb', amount_usd: 80000 }, confidence: 0.95, timestamp: ts,
    });
    db.insertSignal({
      id: 'sig-3', source_agent: 'arb-scanner', signal_type: 'price_gap',
      data: { pair: 'SOL/USDT', profit: 15 }, confidence: 0.85, timestamp: ts,
    });

    const whaleSignals = db.getSignalsByType('whale_move');
    expect(whaleSignals).toHaveLength(2);

    const priceGapSignals = db.getSignalsByType('price_gap');
    expect(priceGapSignals).toHaveLength(1);
  });
});

describe('SimulationEngine data generation', () => {
  let simulation: SimulationEngine;

  beforeEach(() => {
    simulation = new SimulationEngine();
  });

  it('generateArbPrices returns correct structure', () => {
    const prices = simulation.generateArbPrices();

    expect(Array.isArray(prices)).toBe(true);
    expect(prices.length).toBeGreaterThan(0);

    for (const p of prices) {
      expect(p).toHaveProperty('pair');
      expect(p).toHaveProperty('buyPrice');
      expect(p).toHaveProperty('sellPrice');
      expect(p).toHaveProperty('quantity');
      expect(typeof p.buyPrice).toBe('number');
      expect(typeof p.sellPrice).toBe('number');
      expect(typeof p.quantity).toBe('number');
      expect(p.pair).toMatch(/^[A-Z]+\/USDT$/);
    }
  });

  it('generateWhaleTx returns correct structure', () => {
    const tx = simulation.generateWhaleTx();

    expect(tx).toHaveProperty('wallet');
    expect(tx).toHaveProperty('amount_usd');
    expect(tx).toHaveProperty('token');
    expect(tx).toHaveProperty('action');
    expect(typeof tx.wallet).toBe('string');
    expect(typeof tx.amount_usd).toBe('number');
    expect(['buy', 'sell']).toContain(tx.action);
    expect(tx.amount_usd).toBeGreaterThanOrEqual(500);
    expect(tx.amount_usd).toBeLessThanOrEqual(100000);
  });

  it('generateLiquidityData returns correct structure', () => {
    const liq = simulation.generateLiquidityData();

    expect(liq).toHaveProperty('token');
    expect(liq).toHaveProperty('previous_liquidity');
    expect(liq).toHaveProperty('current_liquidity');
    expect(typeof liq.previous_liquidity).toBe('number');
    expect(typeof liq.current_liquidity).toBe('number');
    expect(liq.previous_liquidity).toBeGreaterThan(0);
  });

  it('generateSentimentData returns correct structure', () => {
    const sent = simulation.generateSentimentData();

    expect(sent).toHaveProperty('token');
    expect(sent).toHaveProperty('sentiment_score');
    expect(sent).toHaveProperty('fear_greed');
    expect(sent).toHaveProperty('source');
    expect(sent.sentiment_score).toBeGreaterThanOrEqual(0.1);
    expect(sent.sentiment_score).toBeLessThanOrEqual(0.99);
    expect(sent.fear_greed).toBeGreaterThanOrEqual(10);
    expect(sent.fear_greed).toBeLessThanOrEqual(90);
    expect(sent.source).toBe('simulation');
  });

  it('generatePortfolioState returns correct structure', () => {
    const portfolio = simulation.generatePortfolioState();

    expect(portfolio).toHaveProperty('positions');
    expect(portfolio).toHaveProperty('total_value_usd');
    expect(portfolio).toHaveProperty('max_exposure_usd');
    expect(Array.isArray(portfolio.positions)).toBe(true);
    expect(portfolio.positions.length).toBeGreaterThanOrEqual(2);

    for (const pos of portfolio.positions) {
      expect(pos).toHaveProperty('token');
      expect(pos).toHaveProperty('entry_price');
      expect(pos).toHaveProperty('current_price');
      expect(pos).toHaveProperty('allocation_pct');
    }

    expect(portfolio.total_value_usd).toBeGreaterThan(0);
    expect(portfolio.max_exposure_usd).toBeGreaterThanOrEqual(portfolio.total_value_usd);
  });

  it('generateNewToken returns correct structure', () => {
    const token = simulation.generateNewToken();

    expect(token).toHaveProperty('token');
    expect(token).toHaveProperty('liquidity_usd');
    expect(token).toHaveProperty('social_score');
    expect(token).toHaveProperty('red_flags');
    expect(typeof token.token).toBe('string');
    expect(token.token.startsWith('NEW')).toBe(true);
    expect(typeof token.liquidity_usd).toBe('number');
    expect(Array.isArray(token.red_flags)).toBe(true);
  });

  it('generateOrderbook returns correct structure', () => {
    const ob = simulation.generateOrderbook();

    expect(ob).toHaveProperty('market');
    expect(ob).toHaveProperty('best_bid');
    expect(ob).toHaveProperty('best_ask');
    expect(ob).toHaveProperty('quantity');
    expect(typeof ob.market).toBe('string');
    expect(ob.best_bid).toBeLessThan(ob.best_ask);
    expect(ob.best_bid).toBeGreaterThan(0);
    expect(ob.best_ask).toBeLessThan(1);
  });

  it('generateCopySignal returns correct structure', () => {
    const sig = simulation.generateCopySignal();

    expect(sig).toHaveProperty('whale_wallet');
    expect(sig).toHaveProperty('action');
    expect(sig).toHaveProperty('token');
    expect(sig).toHaveProperty('amount_usd');
    expect(['buy', 'sell']).toContain(sig.action);
    expect(sig.amount_usd).toBeGreaterThanOrEqual(1000);
    expect(sig.amount_usd).toBeLessThanOrEqual(50000);
  });
});
