export interface IndicatorValues {
    ema20: (number | null)[];
    ema50: (number | null)[];
    ema200: (number | null)[];
    rsi14: (number | null)[];
    macd: {
        line: (number | null)[];
        signal: (number | null)[];
        histogram: (number | null)[];
    };
    atr14: (number | null)[];
    bollingerBands: {
        upper: (number | null)[];
        middle: (number | null)[];
        lower: (number | null)[];
    };
}
export interface IndicatorResponse {
    symbol: string;
    timeframe: string;
    indicators: IndicatorValues;
}
