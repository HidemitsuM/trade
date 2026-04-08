import type { Signal, SignalType, AgentStatus } from './types.js';
import type { SignalBus } from './signal-bus.js';
import type { Database } from './db.js';
import { SimulationEngine } from './simulation.js';
import { logger } from './logger.js';
import { randomUUID } from 'node:crypto';

export abstract class BaseAgent {
  public readonly name: string;
  protected config: { interval_ms: number };
  protected signalBus: SignalBus | null = null;
  protected db: Database | null = null;
  protected simulation: SimulationEngine | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private status: AgentStatus = 'idle';
  private consecutiveErrors = 0;

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

    // Subscribe to signal types
    if (this.signalBus) {
      const types = this.getSubscribedSignalTypes();
      for (const type of types) {
        this.signalBus.subscribe(type, (signal) => {
          this.onSignal(signal).catch((err) => {
            logger.error(`Agent ${this.name} onSignal error`, { error: String(err) });
          });
        });
      }
    }

    this.timer = setInterval(() => {
      this.tick().then(() => {
        if (this.consecutiveErrors > 0) this.consecutiveErrors = 0;
        if (this.status === 'error') this.status = 'running';
      }).catch((err) => {
        this.consecutiveErrors++;
        logger.error(`Agent ${this.name} tick error`, { error: String(err), consecutive_errors: this.consecutiveErrors });
        this.status = 'error';
        if (this.consecutiveErrors >= 3) {
          logger.warn(`Agent ${this.name} circuit breaker triggered`, { consecutive_errors: this.consecutiveErrors });
        }
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
