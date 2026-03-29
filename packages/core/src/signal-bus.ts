import Redis from 'ioredis';
import type { Signal, SignalType } from './types.js';
import { logger } from './logger.js';

export type SignalHandler = (signal: Signal) => void;

export class SignalBus {
  private publisher: Redis;
  private subscribers: Map<string, Redis> = new Map();
  private handlers: Map<string, Set<SignalHandler>> = new Map();

  constructor(redisUrl: string) {
    this.publisher = new Redis(redisUrl);
    logger.info('SignalBus initialized', { redisUrl });
  }

  async publish(signal: Signal): Promise<void> {
    const channel = `signal:${signal.signal_type}`;
    const payload = JSON.stringify(signal);
    await this.publisher.publish(channel, payload);
    logger.debug('Signal published', { channel, signal_id: signal.id });
  }

  async subscribe(signalType: SignalType, handler: SignalHandler): Promise<SignalHandler> {
    if (!this.handlers.has(signalType)) {
      this.handlers.set(signalType, new Set());
    }
    this.handlers.get(signalType)!.add(handler);

    if (!this.subscribers.has(signalType)) {
      const sub = new Redis(
        this.publisher.options.host ?? 'localhost',
        this.publisher.options.port ?? 6379
      );
      this.subscribers.set(signalType, sub);

      const channel = `signal:${signalType}`;
      await sub.subscribe(channel);

      sub.on('message', (ch: string, message: string) => {
        if (ch !== channel) return;
        try {
          const signal: Signal = JSON.parse(message);
          const handlers = this.handlers.get(signalType);
          if (handlers) {
            for (const h of handlers) {
              h(signal);
            }
          }
        } catch (err) {
          logger.error('Failed to parse signal', { error: String(err) });
        }
      });
    }

    return handler;
  }

  async unsubscribe(signalType: SignalType, handler: SignalHandler): Promise<void> {
    const handlers = this.handlers.get(signalType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        const sub = this.subscribers.get(signalType);
        if (sub) {
          await sub.unsubscribe(`signal:${signalType}`);
          sub.disconnect();
          this.subscribers.delete(signalType);
        }
        this.handlers.delete(signalType);
      }
    }
  }

  async disconnect(): Promise<void> {
    for (const [, sub] of this.subscribers) {
      sub.disconnect();
    }
    this.subscribers.clear();
    this.handlers.clear();
    this.publisher.disconnect();
    logger.info('SignalBus disconnected');
  }
}
