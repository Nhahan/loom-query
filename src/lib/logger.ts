export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  traceId?: string;
  [key: string]: unknown;
}

function writeLogEntry(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  process.stdout.write(JSON.stringify(entry) + '\n');
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>): void {
    writeLogEntry('debug', message, meta);
  },
  info(message: string, meta?: Record<string, unknown>): void {
    writeLogEntry('info', message, meta);
  },
  warn(message: string, meta?: Record<string, unknown>): void {
    writeLogEntry('warn', message, meta);
  },
  error(message: string, meta?: Record<string, unknown>): void {
    writeLogEntry('error', message, meta);
  },
};
