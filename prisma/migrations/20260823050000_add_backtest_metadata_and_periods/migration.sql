ALTER TABLE "BacktestRun" ADD COLUMN "dataVersion" TEXT;
ALTER TABLE "BacktestRun" ADD COLUMN "indicatorParameters" JSONB;
ALTER TABLE "BacktestRun" ADD COLUMN "marketStructureParameters" JSONB;
ALTER TABLE "BacktestRun" ADD COLUMN "executionAssumptions" JSONB;
ALTER TABLE "BacktestRun" ADD COLUMN "drawdownCurve" JSONB;
ALTER TABLE "BacktestRun" ADD COLUMN "periodResults" JSONB;