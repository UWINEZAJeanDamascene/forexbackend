import { Request, Response } from 'express';
/**
 * GET /api/health
 * Simple liveness check. Used to verify the backend process is running
 * and reachable, independent of database/provider/AI status.
 */
export declare function getHealth(_req: Request, res: Response): void;
