import type { Signal, SignalType, AgentStatus } from './types.js';
import { logger } from './logger.js';
import { randomUUID } from 'node:crypto';

export abstract class BaseAgent {
  protected name: string;
  protected config: { interval_ms: number };
  private timer: ReturnType<typeof setInterval> | null = null;
  private status: AgentStatus = 'idle';

  constructor(name: string, config: { interval_ms: number }) {
    this.name = name;
    this.config = config;
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
    return signal;
  }
}
