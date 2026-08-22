"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLogger = createLogger;
function write(level, scope, message, fields) {
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
function createLogger(scope) {
    return {
        debug: (message, fields) => write('debug', scope, message, fields),
        info: (message, fields) => write('info', scope, message, fields),
        warn: (message, fields) => write('warn', scope, message, fields),
        error: (message, fields) => write('error', scope, message, fields),
    };
}
//# sourceMappingURL=logger.js.map