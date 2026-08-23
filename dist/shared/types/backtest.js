"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_BACKTEST_EXECUTION_ASSUMPTIONS = void 0;
exports.DEFAULT_BACKTEST_EXECUTION_ASSUMPTIONS = {
    entryModel: 'next_candle_open',
    stopLossModel: 'atr',
    takeProfitModel: 'risk_reward',
    positionSizingMethod: 'risk_percent',
    spreadPips: 0,
    slippagePips: 0,
    commissionPerTrade: 0,
    atrStopMultiplier: 1,
    atrTargetMultiplier: 2,
    riskRewardRatio: 2,
    ambiguousCandlePolicy: 'stop_first',
    maxOpenTrades: 1,
};
//# sourceMappingURL=backtest.js.map