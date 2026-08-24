import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            historyUserId?: string;
        }
    }
}
export declare function setHistorySession(res: Response, userId: string): void;
export declare function requireHistorySession(req: Request, res: Response, next: NextFunction): void;
