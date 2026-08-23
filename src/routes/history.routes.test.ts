import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../services/analysisHistoryService', () => ({
  saveAnalysis: vi.fn(),
  listHistory: vi.fn(),
  getAnalysisDetail: vi.fn(),
  deleteAnalysis: vi.fn(),
}));

import { createApp } from '../app';
import { saveAnalysis, listHistory, getAnalysisDetail, deleteAnalysis } from '../services/analysisHistoryService';

const mockedSaveAnalysis = vi.mocked(saveAnalysis);
const mockedListHistory = vi.mocked(listHistory);
const mockedGetAnalysisDetail = vi.mocked(getAnalysisDetail);
const mockedDeleteAnalysis = vi.mocked(deleteAnalysis);

describe('POST /api/analysis/history', () => {
  beforeEach(() => {
    mockedSaveAnalysis.mockReset();
    mockedListHistory.mockReset();
    mockedGetAnalysisDetail.mockReset();
    mockedDeleteAnalysis.mockReset();
  });

  it('returns 400 when required fields are missing', async () => {
    const app = createApp();
    const res = await request(app).post('/api/analysis/history').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('required');
  });

  it('returns 201 and saves analysis on success', async () => {
    mockedSaveAnalysis.mockResolvedValue({ id: 'abc123' });

    const app = createApp();
    const res = await request(app)
      .post('/api/analysis/history')
      .send({
        symbol: 'EUR/USD',
        timeframe: '1H',
        analysisTimestamp: '2024-01-01T10:00:00.000Z',
        currentPrice: 1.1234,
        dataProvider: 'twelvedata',
        trend: 'bullish',
        momentum: 'bullish',
        volatility: 'normal',
        structureTrend: 'bullish',
        higherHighsCount: 5,
        higherLowsCount: 4,
        lowerHighsCount: 2,
        lowerLowsCount: 1,
        confidenceScore: 72,
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('abc123');
    expect(mockedSaveAnalysis).toHaveBeenCalledTimes(1);
  });

  it('returns 500 when the service throws', async () => {
    mockedSaveAnalysis.mockRejectedValue(new Error('database down'));

    const app = createApp();
    const res = await request(app)
      .post('/api/analysis/history')
      .send({
        symbol: 'EUR/USD',
        timeframe: '1H',
        analysisTimestamp: '2024-01-01T10:00:00.000Z',
        currentPrice: 1.1234,
        dataProvider: 'twelvedata',
        trend: 'bullish',
        momentum: 'bullish',
        volatility: 'normal',
        structureTrend: 'bullish',
        higherHighsCount: 5,
        higherLowsCount: 4,
        lowerHighsCount: 2,
        lowerLowsCount: 1,
        confidenceScore: 72,
      });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Analysis completed, but could not be saved to history.');
  });
});

describe('GET /api/analysis/history', () => {
  beforeEach(() => {
    mockedSaveAnalysis.mockReset();
    mockedListHistory.mockReset();
    mockedGetAnalysisDetail.mockReset();
    mockedDeleteAnalysis.mockReset();
  });

  it('returns a paginated list of analyses', async () => {
    mockedListHistory.mockResolvedValue({
      analyses: [
        {
          id: '1',
          symbol: 'EUR/USD',
          timeframe: '1H',
          analysisTimestamp: '2024-01-01T10:00:00.000Z',
          currentPrice: 1.1234,
          dataProvider: 'twelvedata',
          trend: 'bullish',
          confidenceScore: 72,
          createdAt: '2024-01-01T10:05:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    const app = createApp();
    const res = await request(app).get('/api/analysis/history');

    expect(res.status).toBe(200);
    expect(res.body.analyses).toHaveLength(1);
    expect(res.body.total).toBe(1);
  });

  it('validates query parameters', async () => {
    const app = createApp();
    const res = await request(app).get('/api/analysis/history').query({ page: '0' });
    expect(res.status).toBe(400);
  });

  it('forwards search to the authenticated history query', async () => {
    mockedListHistory.mockResolvedValue({ analyses: [], total: 0, page: 1, pageSize: 20 });
    const app = createApp();
    const res = await request(app).get('/api/analysis/history').query({ search: 'EUR/USD' });

    expect(res.status).toBe(200);
    expect(mockedListHistory).toHaveBeenCalledWith(expect.objectContaining({ search: 'EUR/USD' }), expect.any(String));
  });
});

describe('GET /api/analysis/history/:id', () => {
  beforeEach(() => {
    mockedSaveAnalysis.mockReset();
    mockedListHistory.mockReset();
    mockedGetAnalysisDetail.mockReset();
    mockedDeleteAnalysis.mockReset();
  });

  it('returns 404 when analysis is missing', async () => {
    mockedGetAnalysisDetail.mockResolvedValue(null);

    const app = createApp();
    const res = await request(app).get('/api/analysis/history/missing-id');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Analysis not found.');
  });

  it('returns the analysis detail on success', async () => {
    mockedGetAnalysisDetail.mockResolvedValue({
      id: 'abc123',
      symbol: 'EUR/USD',
      timeframe: '1H',
      analysisTimestamp: '2024-01-01T10:00:00.000Z',
      currentPrice: 1.1234,
      dataProvider: 'twelvedata',
      trend: 'bullish',
      confidenceScore: 72,
      indicators: [],
      srLevels: [],
      createdAt: '2024-01-01T10:05:00.000Z',
      updatedAt: '2024-01-01T10:05:00.000Z',
      aiAvailable: false,
    });

    const app = createApp();
    const res = await request(app).get('/api/analysis/history/abc123');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('abc123');
  });
});

describe('DELETE /api/analysis/history/:id', () => {
  beforeEach(() => {
    mockedSaveAnalysis.mockReset();
    mockedListHistory.mockReset();
    mockedGetAnalysisDetail.mockReset();
    mockedDeleteAnalysis.mockReset();
  });

  it('returns 404 when analysis does not exist', async () => {
    mockedDeleteAnalysis.mockResolvedValue(false);

    const app = createApp();
    const res = await request(app).delete('/api/analysis/history/missing-id');

    expect(res.status).toBe(404);
  });

  it('returns 204 on successful delete', async () => {
    mockedDeleteAnalysis.mockResolvedValue(true);

    const app = createApp();
    const res = await request(app).delete('/api/analysis/history/abc123');

    expect(res.status).toBe(204);
  });

  it('returns 500 when the database delete fails', async () => {
    mockedDeleteAnalysis.mockRejectedValue(new Error('database unavailable'));
    const app = createApp();
    const res = await request(app).delete('/api/analysis/history/abc123');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
  });
});
