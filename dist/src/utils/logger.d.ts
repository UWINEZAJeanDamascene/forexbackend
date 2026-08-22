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
export declare function createLogger(scope: string): {
    debug: (message: string, fields?: LogFields) => void;
    info: (message: string, fields?: LogFields) => void;
    warn: (message: string, fields?: LogFields) => void;
    error: (message: string, fields?: LogFields) => void;
};
