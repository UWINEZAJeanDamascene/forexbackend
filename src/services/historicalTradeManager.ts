import { Candle } from '../../../shared/types/market';
import { BacktestExecutionPlan, BacktestExecutionAssumptions, BacktestSetupRecord, BacktestTrade } from '../../../shared/types/backtest';
import { calculateHistoricalPositionSize } from './historicalExecutionService';

interface OpenTradeState {
  trade: BacktestTrade;
  plan: BacktestExecutionPlan;
  entryIndex: number;
}

export class HistoricalTradeManager {
  private readonly openTrades = new Map<string, OpenTradeState>();
  private readonly completedTrades: BacktestTrade[] = [];
  private readonly seenSetupKeys = new Set<string>();
  private nextTradeNumber = 1;

  constructor(private readonly execution: BacktestExecutionAssumptions) {
    if (!Number.isInteger(execution.maxOpenTrades) || execution.maxOpenTrades < 1) {
      throw new Error('maxOpenTrades must be a positive integer.');
    }
  }

  getOpenTrades(): BacktestTrade[] {
    return [...this.openTrades.values()].map((state) => state.trade);
  }

  getCompletedTrades(): BacktestTrade[] {
    return [...this.completedTrades];
  }

  openTrade(
    setup: BacktestSetupRecord,
    plan: BacktestExecutionPlan,
    accountSize: number,
    riskPercent: number,
    fixedPositionUnits?: number,
    quoteToAccountRate = 1
  ): BacktestTrade | null {
    const setupKey = `${setup.timestamp}:${setup.direction}`;
    if (this.seenSetupKeys.has(setupKey) || this.openTrades.size >= this.execution.maxOpenTrades) return null;
    if (!Number.isInteger(plan.entryIndex) || plan.entryIndex < 0) throw new Error('Trade entry index must be a valid historical candle index.');
    if (this.execution.positionSizingMethod === 'fixed_units' && fixedPositionUnits === undefined) {
      throw new Error('Fixed position units are required when fixed_units sizing is selected.');
    }

    const sizing = calculateHistoricalPositionSize(
      setup,
      plan,
      accountSize,
      riskPercent,
      this.execution.positionSizingMethod === 'fixed_units' ? fixedPositionUnits : undefined,
      quoteToAccountRate
    );
    const trade: BacktestTrade = {
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

  processCandle(index: number, candle: Candle, higherResolutionCandles: Candle[] = []): BacktestTrade[] {
    const closed: BacktestTrade[] = [];
    for (const [id, state] of this.openTrades) {
      if (index <= state.entryIndex) continue;
      const bullish = state.trade.direction === 'bullish';
      const stopHit = bullish ? candle.low <= state.plan.stopFillPrice : candle.high >= state.plan.stopFillPrice;
      const targetHit = bullish ? candle.high >= state.plan.targetFillPrice : candle.low <= state.plan.targetFillPrice;
      if (!stopHit && !targetHit) continue;

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

  closeAtEnd(candle: Candle): BacktestTrade[] {
    const closed: BacktestTrade[] = [];
    for (const [id, state] of this.openTrades) {
      const exitCost = state.plan.exitSpreadCost + state.plan.exitSlippageCost;
      const exitPrice = state.trade.direction === 'bullish' ? candle.close - exitCost : candle.close + exitCost;
      closed.push(this.closeState(id, state, candle, exitPrice, 'end_of_test'));
    }
    return closed;
  }

  private closeState(id: string, state: OpenTradeState, candle: Candle, exitPrice: number, exitReason: BacktestTrade['exitReason']): BacktestTrade {
    if (state.trade.result !== 'open') throw new Error('Only open trades can be closed.');
    const holdingMinutes = Math.max(0, (new Date(candle.timestamp).getTime() - new Date(state.trade.entryTimestamp).getTime()) / 60000);
    const directionMultiplier = state.trade.direction === 'bullish' ? 1 : -1;
    const grossPnl = (exitPrice - state.trade.entryPrice) * directionMultiplier * state.trade.positionSize;
    const pnl = grossPnl - this.execution.commissionPerTrade;
    const result = exitReason === 'ambiguous' || Math.abs(pnl) < Number.EPSILON ? 'breakeven' : pnl > 0 ? 'win' : 'loss';
    const closed: BacktestTrade = {
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

  private resolveAmbiguousExit(state: OpenTradeState, higherResolutionCandles: Candle[]): 'stop' | 'target' | 'ambiguous' {
    const bullish = state.trade.direction === 'bullish';
    const ordered = [...higherResolutionCandles].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    for (const candle of ordered) {
      const stopHit = bullish ? candle.low <= state.plan.stopFillPrice : candle.high >= state.plan.stopFillPrice;
      const targetHit = bullish ? candle.high >= state.plan.targetFillPrice : candle.low <= state.plan.targetFillPrice;
      if (stopHit && targetHit) return this.configuredAmbiguousExit();
      if (stopHit) return 'stop';
      if (targetHit) return 'target';
    }

    return this.configuredAmbiguousExit();
  }

  private configuredAmbiguousExit(): 'stop' | 'target' | 'ambiguous' {
    if (this.execution.ambiguousCandlePolicy === 'breakeven') return 'ambiguous';
    return this.execution.ambiguousCandlePolicy === 'target_first' ? 'target' : 'stop';
  }
}