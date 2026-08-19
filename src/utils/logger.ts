/**
 * Minimal structured logger. Deliberately zero-dependency (no winston/pino)
 * at this stage - can be swapped for a real logging library in Phase 30
 * (Monitoring) without changing call sites, since everything goes through
 * this module.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogFields {
  [key: string]: unknown;
}

function write(level: LogLevel, scope: string, message: string, fields?: LogFields): void {
  const line = `[${level}] [${scope}] ${message}`;
  const payload = fields && Object.keys(fields).length > 0 ? fields : undefined;

  switch (level) {
    case 'error':
      payload ? console.error(line, payload) : console.error(line);
      break;
    case 'warn':
      payload ? console.warn(line, payload) : console.warn(line);
      break;
    default:
      payload ? console.log(line, payload) : console.log(line);
  }
}

export function createLogger(scope: string) {
  return {
    debug: (message: string, fields?: LogFields) => write('debug', scope, message, fields),
    info: (message: string, fields?: LogFields) => write('info', scope, message, fields),
    warn: (message: string, fields?: LogFields) => write('warn', scope, message, fields),
    error: (message: string, fields?: LogFields) => write('error', scope, message, fields),
  };
}
