import { Request, Response } from 'express';
/**
 * GET /api/market/candles?symbol=EUR/USD&timeframe=1H&limit=100
 *
 * Returns validated candles ready for the chart. This is the ONLY way the
 * frontend gets market data - it never talks to the provider or Twelve
 * Data directly.
 */
export declare function getCandles(req: Request, res: Response): Promise<void>;
/** GET /api/market/symbols and /api/market/timeframes - lets the frontend build its selectors from the same source of truth as the backend. */
export declare function getSymbols(_req: Request, res: Response): void;
export declare function getTimeframes(_req: Request, res: Response): void;
