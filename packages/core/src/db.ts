import BetterSqlite3 from 'better-sqlite3';
import type { TradeLog, Signal, AgentState, RiskState } from './types.js';
import { logger } from './logger.js';

export class Database {
  private db: BetterSqlite3.Database;

  constructor(dbPath: string) {
    this.db = new BetterSqlite3(dbPath);
    this.db.pragma('journal_mode = WAL');
  }

  initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS trade_log (
        id TEXT PRIMARY KEY,
        agent TEXT NOT NULL,
        pair TEXT NOT NULL,
        side TEXT NOT NULL,
        entry_price REAL,
        exit_price REAL,
        quantity REAL,
        pnl REAL,
        fee REAL,
        chain TEXT,
        tx_hash TEXT,
        simulated BOOLEAN DEFAULT 1,
        timestamp TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS signal_log (
        id TEXT PRIMARY KEY,
        source_agent TEXT NOT NULL,
        signal_type TEXT NOT NULL,
        data_json TEXT NOT NULL,
        confidence REAL,
        consumed_by TEXT,
        timestamp TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS agent_state (
        id TEXT PRIMARY KEY,
        agent_name TEXT UNIQUE NOT NULL,
        status TEXT NOT NULL,
        config_json TEXT,
        last_heartbeat TEXT,
        total_pnl REAL DEFAULT 0,
        trade_count INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS risk_state (
        id TEXT PRIMARY KEY,
        metric TEXT NOT NULL,
        value REAL NOT NULL,
        threshold REAL NOT NULL,
        breached BOOLEAN DEFAULT 0,
        timestamp TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS wallet_state (
        id TEXT PRIMARY KEY,
        chain TEXT NOT NULL,
        address TEXT NOT NULL,
        balance_json TEXT NOT NULL,
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);

    logger.info('Database initialized', { tables: 5 });
  }

  insertTrade(trade: TradeLog): void {
    this.db.prepare(`
      INSERT INTO trade_log (id, agent, pair, side, entry_price, exit_price, quantity, pnl, fee, chain, tx_hash, simulated, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      trade.id, trade.agent, trade.pair, trade.side,
      trade.entry_price, trade.exit_price, trade.quantity,
      trade.pnl, trade.fee, trade.chain, trade.tx_hash,
      trade.simulated ? 1 : 0, trade.timestamp
    );
  }

  getTradesByAgent(agent: string): TradeLog[] {
    return this.db.prepare('SELECT * FROM trade_log WHERE agent = ? ORDER BY timestamp DESC').all(agent) as TradeLog[];
  }

  getAgentPnl(agent: string): number {
    const row = this.db.prepare(
      "SELECT COALESCE(SUM(pnl), 0) as total FROM trade_log WHERE agent = ? AND pnl IS NOT NULL"
    ).get(agent) as { total: number };
    return row.total;
  }

  insertSignal(signal: Signal): void {
    this.db.prepare(`
      INSERT INTO signal_log (id, source_agent, signal_type, data_json, confidence, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      signal.id, signal.source_agent, signal.signal_type,
      JSON.stringify(signal.data), signal.confidence, signal.timestamp
    );
  }

  getSignalsByType(type: string): Signal[] {
    const rows = this.db.prepare(
      'SELECT * FROM signal_log WHERE signal_type = ? ORDER BY timestamp DESC'
    ).all(type) as (Signal & { data_json: string })[];

    return rows.map(({ data_json, ...rest }) => ({
      ...rest,
      data: JSON.parse(data_json),
    }));
  }

  upsertAgentState(agent: AgentState): void {
    this.db.prepare(`
      INSERT INTO agent_state (id, agent_name, status, config_json, last_heartbeat, total_pnl, trade_count)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(agent_name) DO UPDATE SET
        status = excluded.status,
        config_json = excluded.config_json,
        last_heartbeat = excluded.last_heartbeat,
        total_pnl = excluded.total_pnl,
        trade_count = excluded.trade_count
    `).run(
      agent.id, agent.agent_name, agent.status,
      JSON.stringify(agent.config), agent.last_heartbeat,
      agent.total_pnl, agent.trade_count
    );
  }

  getAgentState(name: string): AgentState | undefined {
    const row = this.db.prepare('SELECT * FROM agent_state WHERE agent_name = ?').get(name) as (AgentState & { config_json: string }) | undefined;
    if (!row) return undefined;
    const { config_json, ...rest } = row;
    return { ...rest, config: JSON.parse(config_json) };
  }

  upsertRiskState(state: RiskState): void {
    this.db.prepare(`
      INSERT INTO risk_state (id, metric, value, threshold, breached, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        value = excluded.value,
        threshold = excluded.threshold,
        breached = excluded.breached,
        timestamp = excluded.timestamp
    `).run(
      `risk-${state.metric}`, state.metric, state.value,
      state.threshold, state.breached ? 1 : 0, state.timestamp
    );
  }

  getRiskStates(): RiskState[] {
    return this.db.prepare('SELECT metric, value, threshold, breached, timestamp FROM risk_state').all() as RiskState[];
  }

  close(): void {
    this.db.close();
  }
}
