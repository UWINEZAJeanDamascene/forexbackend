import { Request, Response } from 'express';
export declare function startBacktestEndpoint(req: Request, res: Response): Promise<void>;
export declare function listBacktestsEndpoint(req: Request, res: Response): Promise<void>;
export declare function getBacktestStatusEndpoint(req: Request, res: Response): Promise<void>;
export declare function getBacktestResultsEndpoint(req: Request, res: Response): Promise<void>;
export declare function getBacktestTradeEndpoint(req: Request, res: Response): Promise<void>;
export declare function cancelBacktestEndpoint(req: Request, res: Response): Promise<void>;
