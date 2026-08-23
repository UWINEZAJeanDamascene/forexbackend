import { Request, Response } from 'express';
export declare function postSaveAnalysis(req: Request, res: Response): Promise<void>;
export declare function getHistoryList(req: Request, res: Response): Promise<void>;
export declare function getHistoryDetail(req: Request, res: Response): Promise<void>;
export declare function deleteHistoryItem(req: Request, res: Response): Promise<void>;
