"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistoricalTradeManager = void 0;
const historicalExecutionService_1 = require("./historicalExecutionService");
class HistoricalTradeManager {
    execution;
    openTrades = new Map();
    completedTrades = [];
    seenSetupKeys = new Set();
    nextTradeNumber = 1;
    constructor(execution) {
        this.execution = execution;
        if (!Number.isInteger(execution.maxOpenTrades) || execution.maxOpenTrades < 1) {
            throw new Error('maxOpenTrades must be a positive integer.');
        }
    }
    getOpenTrades() {
        return [...this.openTrades.values()].map((state) => state.trade);
    }
    getCompletedTrades() {
        return [...this.completedTrades];
    }
    openTrade(setup, plan, accountSize, riskPercent, fixedPositionUnits, quoteToAccountRate = 1) {
        const setupKey = `${setup.timestamp}:${setup.direction}`;
        if (this.seenSetupKeys.has(setupKey) || this.openTrades.size >= this.execution.maxOpenTrades)
            return null;
        if (!Number.isInteger(plan.entryIndex) || plan.entryIndex < 0)
            throw new Error('Trade entry index must be a valid historical candle index.');
        if (this.execution.positionSizingMethod === 'fixed_units' && fixedPositionUnits === undefined) {
            throw new Error('Fixed position units are required when fixed_units sizing is selected.');
        }
        const sizing = (0, historicalExecutionService_1.calculateHistoricalPositionSize)(setup, plan, accountSize, riskPercent, this.execution.positionSizingMethod === 'fixed_units' ? fixedPositionUnits : undefined, quoteToAccountRate);
        const trade = {
            id: `trade-${this.nextTradeNumber++}`,
            symbol: setup.snapshot.symbol,
            timeframe: setup.snapshot.timeframe,
            direction: setup.direction,
            setupTimestamp: setup.timestamp,
            entryTimestamp: plan.entryTimestamp,
            exitTimestamp: null,
            entryPrice: plan.entryPrice,
            stopPrice: plan.stopPrice,
            targetPrice: plan.targetPrice,
            exitPrice: null,
            positionSize: sizing.units,
            plannedRiskReward: plan.plannedRiskReward,
            realizedPnl: null,
            realizedR: null,
            result: 'open',
            holdingMinutes: null,
            exitReason: 'none',
            setupConditions: setup.conditionsMet,
            setupSnapshot: setup.snapshot,
        };
        this.seenSetupKeys.add(setupKey);
        this.openTrades.set(trade.id, { trade, plan, entryIndex: plan.entryIndex });
        return trade;
    }
    processCandle(index, candle, higherResolutionCandles = []) {
        const closed = [];
        for (const [id, state] of this.openTrades) {
            if (index <= state.entryIndex)
                continue;
            const bullish = state.trade.direction === 'bullish';
            const stopHit = bullish ? candle.low <= state.plan.stopFillPrice : candle.high >= state.plan.stopFillPrice;
            const targetHit = bullish ? candle.high >= state.plan.targetFillPrice : candle.low <= state.plan.targetFillPrice;
            if (!stopHit && !targetHit)
                continue;
            const bothHit = stopHit && targetHit;
            const exitReason = bothHit
                ? this.resolveAmbiguousExit(state, higherResolutionCandles)
                : stopHit ? 'stop' : 'target';
            const exitPrice = exitReason === 'ambiguous'
                ? state.trade.entryPrice
                : exitReason === 'stop' ? state.plan.stopFillPrice : state.plan.targetFillPrice;
            closed.push(this.closeState(id, state, candle, exitPrice, exitReason));
        }
        return closed;
    }
    closeAtEnd(candle) {
        const closed = [];
        for (const [id, state] of this.openTrades) {
            const exitCost = state.plan.exitSpreadCost + state.plan.exitSlippageCost;
            const exitPrice = state.trade.direction === 'bullish' ? candle.close - exitCost : candle.close + exitCost;
            closed.push(this.closeState(id, state, candle, exitPrice, 'end_of_test'));
        }
        return closed;
    }
    closeState(id, state, candle, exitPrice, exitReason) {
        if (state.trade.result !== 'open')
            throw new Error('Only open trades can be closed.');
        const holdingMinutes = Math.max(0, (new Date(candle.timestamp).getTime() - new Date(state.trade.entryTimestamp).getTime()) / 60000);
        const directionMultiplier = state.trade.direction === 'bullish' ? 1 : -1;
        const grossPnl = (exitPrice - state.trade.entryPrice) * directionMultiplier * state.trade.positionSize;
        const pnl = grossPnl - this.execution.commissionPerTrade;
        const result = exitReason === 'ambiguous' || Math.abs(pnl) < Number.EPSILON ? 'breakeven' : pnl > 0 ? 'win' : 'loss';
        const closed = {
            ...state.trade,
            exitTimestamp: candle.timestamp,
            exitPrice,
            realizedPnl: pnl,
            realizedR: state.plan.riskDistance > 0 ? pnl / (state.plan.riskDistance * state.trade.positionSize) : null,
            result,
            holdingMinutes,
            exitReason,
        };
        this.openTrades.delete(id);
        this.completedTrades.push(closed);
        return closed;
    }
    resolveAmbiguousExit(state, higherResolutionCandles) {
        const bullish = state.trade.direction === 'bullish';
        const ordered = [...higherResolutionCandles].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        for (const candle of ordered) {
            const stopHit = bullish ? candle.low <= state.plan.stopFillPrice : candle.high >= state.plan.stopFillPrice;
            const targetHit = bullish ? candle.high >= state.plan.targetFillPrice : candle.low <= state.plan.targetFillPrice;
            if (stopHit && targetHit)
                return this.configuredAmbiguousExit();
            if (stopHit)
                return 'stop';
            if (targetHit)
                return 'target';
        }
        return this.configuredAmbiguousExit();
    }
    configuredAmbiguousExit() {
        if (this.execution.ambiguousCandlePolicy === 'breakeven')
            return 'ambiguous';
        return this.execution.ambiguousCandlePolicy === 'target_first' ? 'target' : 'stop';
    }
}
exports.HistoricalTradeManager = HistoricalTradeManager;
//# sourceMappingURL=historicalTradeManager.js.map