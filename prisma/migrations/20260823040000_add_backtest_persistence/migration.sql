CREATE TABLE "BacktestRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "strategyName" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "dataProvider" TEXT NOT NULL,
    "dataSource" TEXT,
    "initialBalance" DOUBLE PRECISION NOT NULL,
    "riskPercent" DOUBLE PRECISION NOT NULL,
    "metrics" JSONB,
    "warnings" JSONB,
    "equityCurve" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "BacktestRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BacktestTrade" (
    "id" TEXT NOT NULL,
    "backtestId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "setupTimestamp" TIMESTAMP(3) NOT NULL,
    "entryTimestamp" TIMESTAMP(3) NOT NULL,
    "exitTimestamp" TIMESTAMP(3),
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "stopPrice" DOUBLE PRECISION NOT NULL,
    "targetPrice" DOUBLE PRECISION NOT NULL,
    "exitPrice" DOUBLE PRECISION,
    "positionSize" DOUBLE PRECISION NOT NULL,
    "plannedRiskReward" DOUBLE PRECISION NOT NULL,
    "realizedPnl" DOUBLE PRECISION,
    "realizedR" DOUBLE PRECISION,
    "result" TEXT NOT NULL,
    "holdingMinutes" DOUBLE PRECISION,
    "exitReason" TEXT NOT NULL,
    "setupConditions" JSONB NOT NULL,
    "setupSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BacktestTrade_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EquitySnapshot" (
    "id" TEXT NOT NULL,
    "backtestId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL,
    "equity" DOUBLE PRECISION NOT NULL,
    "peakEquity" DOUBLE PRECISION NOT NULL,
    "drawdown" DOUBLE PRECISION NOT NULL,
    "drawdownPercent" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "EquitySnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BacktestRun_userId_createdAt_idx" ON "BacktestRun"("userId", "createdAt");
CREATE INDEX "BacktestRun_status_createdAt_idx" ON "BacktestRun"("status", "createdAt");
CREATE INDEX "BacktestTrade_backtestId_entryTimestamp_idx" ON "BacktestTrade"("backtestId", "entryTimestamp");
CREATE INDEX "BacktestTrade_backtestId_result_idx" ON "BacktestTrade"("backtestId", "result");
CREATE UNIQUE INDEX "EquitySnapshot_backtestId_timestamp_key" ON "EquitySnapshot"("backtestId", "timestamp");
CREATE INDEX "EquitySnapshot_backtestId_timestamp_idx" ON "EquitySnapshot"("backtestId", "timestamp");
ALTER TABLE "BacktestRun" ADD CONSTRAINT "BacktestRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BacktestTrade" ADD CONSTRAINT "BacktestTrade_backtestId_fkey" FOREIGN KEY ("backtestId") REFERENCES "BacktestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EquitySnapshot" ADD CONSTRAINT "EquitySnapshot_backtestId_fkey" FOREIGN KEY ("backtestId") REFERENCES "BacktestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;