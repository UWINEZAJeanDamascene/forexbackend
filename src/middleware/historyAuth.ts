import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

const SESSION_COOKIE = 'forex_history_session';
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;
const SESSION_SECRET = process.env.HISTORY_SESSION_SECRET || (
  process.env.NODE_ENV === 'production'
    ? (() => { throw new Error('HISTORY_SESSION_SECRET is required in production.'); })()
    : 'development-history-session-secret'
);

declare global {
  namespace Express {
    interface Request {
      historyUserId?: string;
    }
  }
}

function sign(userId: string): string {
  return crypto.createHmac('sha256', SESSION_SECRET).update(userId).digest('base64url');
}

function validSession(value: string | undefined): string | null {
  if (!value) return null;
  const [userId, signature] = value.split('.');
  if (!userId || !signature || !/^[a-f0-9-]{36}$/i.test(userId)) return null;

  const expected = sign(userId);
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (receivedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)) return null;
  return userId;
}

function readCookie(header: string | undefined): string | undefined {
  const value = header?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return value?.slice(SESSION_COOKIE.length + 1);
}

export function setHistorySession(res: Response, userId: string): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${userId}.${sign(userId)}; Max-Age=${SESSION_MAX_AGE_MS / 1000}; HttpOnly; SameSite=Lax; Path=/api${secure}`);
}

export function requireHistorySession(req: Request, res: Response, next: NextFunction): void {
  const existingUserId = validSession(readCookie(req.headers.cookie));
  const userId = existingUserId ?? crypto.randomUUID();

  req.historyUserId = userId;
  if (!existingUserId) {
    setHistorySession(res, userId);
  }

  next();
}