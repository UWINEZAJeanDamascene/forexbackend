import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';

describe('Backtest API validation', () => {
  it('rejects an invalid configuration before queueing a run', async () => {
    const response = await request(createApp()).post('/api/backtests').send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid backtest configuration.');
    expect(response.body.issues).toEqual(expect.arrayContaining([
      'symbol must be one of the enabled instruments.',
      'timeframe must be one of the enabled timeframes.',
      'period is required.',
      'execution is required.',
    ]));
  });
});