-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Analysis" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "analysisTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "marketDataTimestamp" TIMESTAMP(3),
    "currentPrice" DOUBLE PRECISION NOT NULL,
    "dataProvider" TEXT NOT NULL,
    "dataFreshnessMs" INTEGER,
    "trend" TEXT NOT NULL,
    "trendStrength" TEXT,
    "trendScore" INTEGER,
    "trendFactors" JSONB,
    "momentum" TEXT NOT NULL,
    "momentumScore" INTEGER,
    "momentumStrength" TEXT,
    "volatility" TEXT NOT NULL,
    "volatilityClassification" TEXT,
    "volatilityScore" INTEGER,
    "structureTrend" TEXT NOT NULL,
    "structureTrendQualifier" TEXT,
    "higherHighsCount" INTEGER NOT NULL,
    "higherLowsCount" INTEGER NOT NULL,
    "lowerHighsCount" INTEGER NOT NULL,
    "lowerLowsCount" INTEGER NOT NULL,
    "confidenceScore" INTEGER NOT NULL,
    "confidenceBand" TEXT,
    "tradeQualityVerdict" TEXT,
    "tradeQualityReasons" JSONB,
    "setupName" TEXT,
    "setupDirection" TEXT,
    "setupStrength" INTEGER,
    "setupConditionsMet" JSONB,
    "setupConditionsMissing" JSONB,
    "setupInvalidation" TEXT,
    "setups" JSONB,
    "aiExplanation" TEXT,
    "aiProvider" TEXT,
    "aiAvailable" BOOLEAN NOT NULL DEFAULT false,
    "aiStructured" JSONB,
    "aiDisclaimer" TEXT,
    "engineVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndicatorSnapshot" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "period" INTEGER,
    "value" DOUBLE PRECISION,
    "upperBand" DOUBLE PRECISION,
    "middleBand" DOUBLE PRECISION,
    "lowerBand" DOUBLE PRECISION,
    "macdLine" DOUBLE PRECISION,
    "signalLine" DOUBLE PRECISION,
    "histogram" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndicatorSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketStructureSnapshot" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "trend" TEXT NOT NULL,
    "trendQualifier" TEXT,
    "events" JSONB,
    "latestEventType" TEXT,
    "latestEventPrice" DOUBLE PRECISION,
    "latestEventTimestamp" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketStructureSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportResistanceSnapshot" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "zoneLow" DOUBLE PRECISION,
    "zoneHigh" DOUBLE PRECISION,
    "strength" INTEGER NOT NULL,
    "touches" INTEGER,
    "lastReactionTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportResistanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Analysis_userId_symbol_timeframe_analysisTimestamp_idx" ON "Analysis"("userId", "symbol", "timeframe", "analysisTimestamp");

-- CreateIndex
CREATE INDEX "Analysis_symbol_timeframe_analysisTimestamp_idx" ON "Analysis"("symbol", "timeframe", "analysisTimestamp");

-- CreateIndex
CREATE INDEX "Analysis_analysisTimestamp_idx" ON "Analysis"("analysisTimestamp");

-- CreateIndex
CREATE INDEX "IndicatorSnapshot_analysisId_idx" ON "IndicatorSnapshot"("analysisId");

-- CreateIndex
CREATE INDEX "MarketStructureSnapshot_analysisId_idx" ON "MarketStructureSnapshot"("analysisId");

-- CreateIndex
CREATE INDEX "SupportResistanceSnapshot_analysisId_idx" ON "SupportResistanceSnapshot"("analysisId");

-- AddForeignKey
ALTER TABLE "Analysis" ADD CONSTRAINT "Analysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndicatorSnapshot" ADD CONSTRAINT "IndicatorSnapshot_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketStructureSnapshot" ADD CONSTRAINT "MarketStructureSnapshot_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportResistanceSnapshot" ADD CONSTRAINT "SupportResistanceSnapshot_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
