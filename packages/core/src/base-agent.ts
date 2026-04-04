import type { Signal, SignalType, AgentStatus } from './types.js';
import { logger } from './logger.js';
import { randomUUID } from 'node:crypto';
import type { Database } from './db.js';
import type { SignalBus } from './signal-bus.js';
import { SimulationEngine } from './simulation.js';

export abstract class BaseAgent {
  protected name: string;
  protected config: { interval_ms: number };
  private timer: ReturnType<typeof setInterval> | null = null;
  private status: AgentStatus = 'idle';
  protected db: Database | null = null;
  protected signalBus: SignalBus | null = null;
  protected simulation: SimulationEngine | null = null;

  constructor(name: string, config: { interval_ms: number }) {
    this.name = name;
    this.config = config;
  }

  setInfrastructure(infra: { db: Database; signalBus: SignalBus; simulation: SimulationEngine }): void {
    this.db = infra.db;
    this.signalBus = infra.signalBus;
    this.simulation = infra.simulation;
  }

  getSubscribedSignalTypes(): SignalType[] {
    return [];
  }

  async start(): Promise<void> {
    if (this.status === 'running') return;
    this.status = 'running';
    logger.info(`Agent ${this.name} started`, { interval_ms: this.config.interval_ms });
    this.timer = setInterval(() => {
      this.tick().catch((err) => {
        logger.error(`Agent ${this.name} tick error`, { error: String(err) });
        this.status = 'error';
      });
    }, this.config.interval_ms);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.status = 'stopped';
    logger.info(`Agent ${this.name} stopped`);
  }

  getStatus(): AgentStatus {
    return this.status;
  }

  protected abstract tick(): Promise<void>;

  protected abstract onSignal(signal: Signal): Promise<void>;

  publishSignal(type: SignalType, data: Record<string, unknown>, confidence: number): Signal {
    const signal: Signal = {
      id: randomUUID(),
      source_agent: this.name,
      signal_type: type,
      data,
      confidence,
      timestamp: new Date().toISOString(),
    };
    logger.debug(`Agent ${this.name} published signal`, { type, signal_id: signal.id });

    // Insert signal into database
    if (this.db) {
      try {
        this.db.insertSignal(signal);
      } catch (err) {
        logger.error(`Agent ${this.name} failed to insert signal`, { error: String(err) });
      }
    }

    // Publish to SignalBus
    if (this.signalBus) {
      this.signalBus.publish(signal).catch((err) => {
        logger.error(`Agent ${this.name} failed to publish signal to bus`, { error: String(err) });
      });
    }

    return signal;
  }
}
