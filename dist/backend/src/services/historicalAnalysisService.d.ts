import { Candle } from '../../../shared/types/market';
import { Symbol, Timeframe } from '../../../shared/constants/instruments';
import { HistoricalDecisionAnalysis } from '../../../shared/types/backtest';
export interface HistoricalAnalysisOptions {
    swingWindow?: number;
    higherTimeframeTrends?: HistoricalDecisionAnalysis['higherTimeframeTrends'];
}
/**
 * Evaluates one completed decision candle using only the prefix available at
 * that point in history. Later candles are deliberately excluded.
 */
export declare function analyzeHistoricalDecision(candles: Candle[], decisionIndex: number, symbol: Symbol, timeframe: Timeframe, options?: HistoricalAnalysisOptions): HistoricalDecisionAnalysis;
