import type { Signal, SignalType, AgentStatus } from './types.js';
import type { SignalBus } from './signal-bus.js';
import type { Database } from './db.js';
import { logger } from './logger.js';
import { randomUUID } from 'node:crypto';

export abstract class BaseAgent {
  protected name: string;
  protected config: { interval_ms: number };
  protected signalBus?: SignalBus;
  protected db?: Database;
  private timer: ReturnType<typeof setInterval> | null = null;
  private status: AgentStatus = 'idle';

  constructor(name: string, config: { interval_ms: number }) {
    this.name = name;
    this.config = config;
  }

  setInfrastructure(signalBus: SignalBus, db: Database): void {
    this.signalBus = signalBus;
    this.db = db;
  }

  protected getSubscribedSignalTypes(): SignalType[] {
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

    if (this.signalBus) {
      this.signalBus.publish(signal).catch((err) => {
        logger.error(`Agent ${this.name} signal publish error`, { error: String(err) });
      });
    }
    if (this.db) {
      this.db.insertSignal(signal);
    }

    return signal;
  }
}
