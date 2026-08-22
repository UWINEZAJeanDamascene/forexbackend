import express, { Application, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { env } from './config/env';
import healthRoutes from './routes/health.routes';
import marketRoutes from './routes/market.routes';
import indicatorsRoutes from './routes/indicators.routes';
import marketStructureRoutes from './routes/market-structure.routes';
import supportResistanceRoutes from './routes/support-resistance.routes';
import trendRoutes from './routes/trend.routes';
import momentumRoutes from './routes/momentum.routes';
import volatilityRoutes from './routes/volatility.routes';
import multiTimeframeRoutes from './routes/multi-timeframe.routes';
import setupsRoutes from './routes/setups.routes';
import confidenceRoutes from './routes/confidence.routes';
import riskRoutes from './routes/risk.routes';
import aiRoutes from './routes/ai.routes';

export function createApp(): Application {
  const app = express();

  app.use(
    cors({
      origin: env.frontendUrl,
    })
  );
  app.use(express.json());

  app.use('/api', healthRoutes);
  app.use('/api', marketRoutes);
  app.use('/api', indicatorsRoutes);
  app.use('/api', marketStructureRoutes);
  app.use('/api', supportResistanceRoutes);
  app.use('/api', trendRoutes);
  app.use('/api', momentumRoutes);
  app.use('/api', volatilityRoutes);
  app.use('/api', multiTimeframeRoutes);
  app.use('/api/analysis', setupsRoutes);
  app.use('/api/analysis', confidenceRoutes);
  app.use('/api/analysis', riskRoutes);
  app.use('/api/analysis', aiRoutes);

  // Future routers (Phase 24 onward) will mount here, e.g.:
  // app.use('/api/analysis', analysisRoutes);
  // app.use('/api/backtest', backtestRoutes);

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found', path: req.originalUrl });
  });

  // Central error handler - never leak raw stack traces to clients.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[error]', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
