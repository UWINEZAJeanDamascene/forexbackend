import { describe, it, expect, vi } from 'vitest';
import { getConfidenceEndpoint } from './confidence.controller';

describe('getConfidenceEndpoint', () => {
  it('returns 400 for invalid symbol', async () => {
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;
    await getConfidenceEndpoint({ query: { symbol: 'INVALID', timeframe: '1H' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 for invalid timeframe', async () => {
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;
    await getConfidenceEndpoint({ query: { symbol: 'EUR/USD', timeframe: 'INVALID' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
