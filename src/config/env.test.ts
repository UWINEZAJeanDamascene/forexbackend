import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getEnv } from './env';

describe('env config', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.PORT;
    delete process.env.FRONTEND_URL;
    delete process.env.DATABASE_URL;
    delete process.env.TWELVE_DATA_API_KEY;
    delete process.env.FINNHUB_API_KEY;
    delete process.env.AI_API_KEY;
    delete process.env.AI_MODEL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('falls back to sensible defaults when nothing is set', () => {
    const config = getEnv();

    expect(config.port).toBe(3001);
    expect(config.frontendUrl).toBe('http://localhost:3000');
    expect(config.databaseUrl).toBeUndefined();
    expect(config.twelveDataApiKey).toBeUndefined();
    expect(config.aiApiKey).toBeUndefined();
    expect(config.aiModel).toBeUndefined();
  });

  it('reads values from process.env when present', () => {
    process.env.PORT = '4000';
    process.env.FRONTEND_URL = 'http://localhost:5000';
    process.env.TWELVE_DATA_API_KEY = 'test-key';
    process.env.FINNHUB_API_KEY = 'test-finnhub-key';

    const config = getEnv();

    expect(config.port).toBe(4000);
    expect(config.frontendUrl).toBe('http://localhost:5000');
    expect(config.twelveDataApiKey).toBe('test-key');
    expect(config.finnhubApiKey).toBe('test-finnhub-key');
  });

  it('never crashes when secrets are missing (they are optional until later phases)', () => {
    expect(() => getEnv()).not.toThrow();
  });
});
