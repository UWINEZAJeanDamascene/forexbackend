import { Request, Response } from 'express';
/**
 * GET /api/market/indicators?symbol=EUR/USD&timeframe=1H
 *
 * Returns all computed technical indicators for the requested symbol and
 * timeframe. Each indicator array is aligned with the returned candles
 * (same length, same order), so the frontend can overlay them on the chart
 * or display the latest values.
 */
export declare function getIndicators(req: Request, res: Response): Promise<void>;
