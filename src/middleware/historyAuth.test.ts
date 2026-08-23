import { describe, expect, it, vi } from 'vitest';
import { requireHistorySession } from './historyAuth';

function response() {
  return {
    setHeader: vi.fn(),
  } as any;
}

describe('requireHistorySession', () => {
  it('creates an HttpOnly session cookie when none is supplied', () => {
    const req = { headers: {} } as any;
    const res = response();
    const next = vi.fn();

    requireHistorySession(req, res, next);

    expect(req.historyUserId).toMatch(/^[a-f0-9-]{36}$/i);
    expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', expect.stringContaining('HttpOnly'));
    expect(next).toHaveBeenCalledOnce();
  });

  it('reuses a valid session cookie without issuing a new one', () => {
    const firstRequest = { headers: {} } as any;
    const firstResponse = response();
    requireHistorySession(firstRequest, firstResponse, vi.fn());
    const cookie = firstResponse.setHeader.mock.calls[0][1].split(';')[0];

    const req = { headers: { cookie } } as any;
    const res = response();
    requireHistorySession(req, res, vi.fn());

    expect(req.historyUserId).toBe(firstRequest.historyUserId);
    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it('rejects a tampered session cookie and issues a replacement', () => {
    const req = { headers: { cookie: 'forex_history_session=00000000-0000-0000-0000-000000000000.invalid' } } as any;
    const res = response();

    requireHistorySession(req, res, vi.fn());

    expect(req.historyUserId).not.toBe('00000000-0000-0000-0000-000000000000');
    expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie', expect.stringContaining('HttpOnly'));
  });
});