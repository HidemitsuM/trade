type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private minLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
  private jsonFormat: boolean = (process.env.LOG_FORMAT ?? '').toLowerCase() === 'json';

  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.minLevel];
  }

  private format(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
    if (this.jsonFormat) {
      return JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        message,
        ...(meta && { meta }),
      });
    }
    const ts = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${ts}] ${level.toUpperCase()} ${message}${metaStr}`;
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('debug')) console.debug(this.format('debug', message, meta));
  }

  info(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('info')) console.info(this.format('info', message, meta));
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('warn')) console.warn(this.format('warn', message, meta));
  }

  error(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('error')) console.error(this.format('error', message, meta));
  }
}

export const logger = new Logger();
