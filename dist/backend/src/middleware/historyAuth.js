"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setHistorySession = setHistorySession;
exports.requireHistorySession = requireHistorySession;
const crypto_1 = __importDefault(require("crypto"));
const SESSION_COOKIE = 'forex_history_session';
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;
const SESSION_SECRET = process.env.HISTORY_SESSION_SECRET || (process.env.NODE_ENV === 'production'
    ? (() => { throw new Error('HISTORY_SESSION_SECRET is required in production.'); })()
    : 'development-history-session-secret');
function sign(userId) {
    return crypto_1.default.createHmac('sha256', SESSION_SECRET).update(userId).digest('base64url');
}
function validSession(value) {
    if (!value)
        return null;
    const [userId, signature] = value.split('.');
    if (!userId || !signature || !/^[a-f0-9-]{36}$/i.test(userId))
        return null;
    const expected = sign(userId);
    const receivedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (receivedBuffer.length !== expectedBuffer.length || !crypto_1.default.timingSafeEqual(receivedBuffer, expectedBuffer))
        return null;
    return userId;
}
function readCookie(header) {
    const value = header?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
    return value?.slice(SESSION_COOKIE.length + 1);
}
function setHistorySession(res, userId) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${userId}.${sign(userId)}; Max-Age=${SESSION_MAX_AGE_MS / 1000}; HttpOnly; SameSite=Lax; Path=/api${secure}`);
}
function requireHistorySession(req, res, next) {
    const existingUserId = validSession(readCookie(req.headers.cookie));
    const userId = existingUserId ?? crypto_1.default.randomUUID();
    req.historyUserId = userId;
    if (!existingUserId) {
        setHistorySession(res, userId);
    }
    next();
}
//# sourceMappingURL=historyAuth.js.map