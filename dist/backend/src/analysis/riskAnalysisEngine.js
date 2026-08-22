"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeRiskAnalysis = computeRiskAnalysis;
const instrumentConfig_1 = require("../../../shared/constants/instrumentConfig");
const DEFAULT_NEARBY_ATR = 1.5;
const DEFAULT_WITHIN_RANGE_ATR = 3.0;
const DEFAULT_MAX_RISK_PERCENT = 10;
const DEFAULT_MIN_RISK_PERCENT = 0.1;
function computeRiskAnalysis(params) {
    const atr = params.volatility.currentAtr;
    const volatilityContext = buildVolatilityContext(params.volatility);
    const nearbySupport = findNearbySupport(params.supportResistance, params.currentPrice, atr);
    const nearbyResistance = findNearbyResistance(params.supportResistance, params.currentPrice, atr);
    const invalidationCandidates = buildInvalidationCandidates(params, nearbySupport, nearbyResistance, atr);
    const riskRewardScenarios = buildRiskRewardScenarios(params.currentPrice, nearbySupport, nearbyResistance, invalidationCandidates);
    let positionSizing = null;
    let positionSizingInput = null;
    if (params.accountSize !== undefined && params.maxRiskPercent !== undefined) {
        positionSizingInput = {
            accountSize: params.accountSize,
            maxRiskPercent: params.maxRiskPercent,
        };
        positionSizing = calculatePositionSizing(params.accountSize, params.maxRiskPercent, invalidationCandidates, params.currentPrice, params.trend.symbol, atr);
    }
    return {
        symbol: params.trend.symbol ?? 'unknown',
        timeframe: params.trend.timeframe ?? 'unknown',
        currentPrice: params.currentPrice,
        nearbySupport,
        nearbyResistance,
        atr,
        volatilityContext,
        invalidationCandidates,
        riskRewardScenarios,
        positionSizing,
        positionSizingInput,
        thresholds: {
            nearbyATR: DEFAULT_NEARBY_ATR,
            withinRangeATR: DEFAULT_WITHIN_RANGE_ATR,
        },
        disclaimer: 'This reflects calculated distances between price and technical levels. It is not a probability of profit, a guaranteed outcome, or trading advice.',
        analyzedAt: new Date().toISOString(),
    };
}
function buildVolatilityContext(volatility) {
    let note = '';
    const classification = volatility.classification;
    if (classification === 'high' || classification === 'very high') {
        note = 'Elevated volatility — structural levels may be reached faster than raw price distance suggests. Consider that stops and targets may need more room.';
    }
    else if (classification === 'low' || classification === 'very low') {
        note = 'Compressed volatility — structural levels are closer in ATR terms than they appear in raw price distance.';
    }
    else {
        note = 'Volatility is within a normal range — distance to levels in ATR terms is representative of typical market conditions.';
    }
    if (volatility.bandDisagreement) {
        note += ' ATR and Bollinger Band width are giving mixed signals — volatility may be shifting unevenly.';
    }
    return {
        atr: volatility.currentAtr,
        atrPercentile: volatility.atrPercentile,
        classification,
        bandDisagreement: volatility.bandDisagreement,
        note,
    };
}
function findNearbySupport(sr, currentPrice, atr) {
    const supports = [...sr.supports, ...sr.tested].filter((s) => s.price < currentPrice);
    if (supports.length === 0)
        return null;
    let nearest = supports[0];
    let nearestDistance = Math.abs(currentPrice - supports[0].price);
    for (const level of supports) {
        const distance = Math.abs(currentPrice - level.price);
        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearest = level;
        }
    }
    const distanceInATR = atr > 0 ? nearestDistance / atr : 0;
    const distanceFromPricePct = (nearestDistance / currentPrice) * 100;
    return {
        price: nearest.price,
        zoneRange: [nearest.zoneLow, nearest.zoneHigh],
        strength: nearest.strength,
        distanceFromPrice: nearestDistance,
        distanceFromPricePct,
        distanceInATR,
        proximity: classifyProximity(distanceInATR),
    };
}
function findNearbyResistance(sr, currentPrice, atr) {
    const resistances = [...sr.resistances, ...sr.tested].filter((r) => r.price > currentPrice);
    if (resistances.length === 0)
        return null;
    let nearest = resistances[0];
    let nearestDistance = Math.abs(currentPrice - resistances[0].price);
    for (const level of resistances) {
        const distance = Math.abs(currentPrice - level.price);
        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearest = level;
        }
    }
    const distanceInATR = atr > 0 ? nearestDistance / atr : 0;
    const distanceFromPricePct = (nearestDistance / currentPrice) * 100;
    return {
        price: nearest.price,
        zoneRange: [nearest.zoneLow, nearest.zoneHigh],
        strength: nearest.strength,
        distanceFromPrice: nearestDistance,
        distanceFromPricePct,
        distanceInATR,
        proximity: classifyProximity(distanceInATR),
    };
}
function classifyProximity(distanceInATR) {
    if (distanceInATR <= DEFAULT_NEARBY_ATR)
        return 'nearby';
    if (distanceInATR <= DEFAULT_WITHIN_RANGE_ATR)
        return 'within_range';
    return 'distant';
}
function buildInvalidationCandidates(params, nearbySupport, nearbyResistance, atr) {
    const { currentPrice } = params;
    const candidates = [];
    const activeSetups = params.setups.filter((s) => s.conditionsMet.length > 0);
    for (const setup of activeSetups) {
        if (setup.invalidationCondition && setup.invalidationCondition.trim().length > 0) {
            const priceMatch = setup.invalidationCondition.match(/(?:below|above)\s+(\d+\.\d+|\d+)/i);
            if (priceMatch) {
                const invalidationPrice = parseFloat(priceMatch[1]);
                const distance = Math.abs(params.currentPrice - invalidationPrice);
                const distanceInATR = atr > 0 ? distance / atr : 0;
                candidates.push({
                    source: 'activeSetup',
                    price: invalidationPrice,
                    description: setup.invalidationCondition,
                    distanceFromPrice: distance,
                    distanceInATR,
                });
            }
        }
    }
    if (params.structure.lastSwingLow) {
        const distance = Math.abs(params.currentPrice - params.structure.lastSwingLow.price);
        candidates.push({
            source: 'protectedStructureLevel',
            price: params.structure.lastSwingLow.price,
            description: `Break of protected swing low at ${params.structure.lastSwingLow.price.toFixed(5)} — would constitute Change of Character`,
            distanceFromPrice: distance,
            distanceInATR: atr > 0 ? distance / atr : 0,
        });
    }
    if (params.structure.lastSwingHigh) {
        const distance = Math.abs(params.currentPrice - params.structure.lastSwingHigh.price);
        candidates.push({
            source: 'protectedStructureLevel',
            price: params.structure.lastSwingHigh.price,
            description: `Break of protected swing high at ${params.structure.lastSwingHigh.price.toFixed(5)} — would constitute Change of Character`,
            distanceFromPrice: distance,
            distanceInATR: atr > 0 ? distance / atr : 0,
        });
    }
    if (nearbySupport && nearbySupport.price < currentPrice) {
        const distance = Math.abs(currentPrice - nearbySupport.price);
        const exists = candidates.some((c) => Math.abs(c.price - nearbySupport.price) < atr * 0.1);
        if (!exists) {
            candidates.push({
                source: 'nearbySupport',
                price: nearbySupport.price,
                description: `Nearby support at ${nearbySupport.price.toFixed(5)}`,
                distanceFromPrice: distance,
                distanceInATR: atr > 0 ? distance / atr : 0,
            });
        }
    }
    if (nearbyResistance && nearbyResistance.price > currentPrice) {
        const distance = Math.abs(currentPrice - nearbyResistance.price);
        const exists = candidates.some((c) => Math.abs(c.price - nearbyResistance.price) < atr * 0.1);
        if (!exists) {
            candidates.push({
                source: 'nearbyResistance',
                price: nearbyResistance.price,
                description: `Nearby resistance at ${nearbyResistance.price.toFixed(5)}`,
                distanceFromPrice: distance,
                distanceInATR: atr > 0 ? distance / atr : 0,
            });
        }
    }
    if (candidates.length === 0 && params.trend.ema.ema50 !== null) {
        const ema50 = params.trend.ema.ema50;
        const distance = Math.abs(params.currentPrice - ema50);
        candidates.push({
            source: 'emaBreak',
            price: ema50,
            description: `Sustained ${ema50 > currentPrice ? 'reclaim' : 'close'} of EMA50 (${ema50.toFixed(5)}) — lower-confidence invalidation signal`,
            distanceFromPrice: distance,
            distanceInATR: atr > 0 ? distance / atr : 0,
        });
    }
    return candidates;
}
function buildRiskRewardScenarios(currentPrice, nearbySupport, nearbyResistance, invalidationCandidates) {
    const scenarios = [];
    if (invalidationCandidates.length === 0)
        return scenarios;
    let bullishInvalidation = invalidationCandidates.find((c) => c.price < currentPrice);
    let bearishInvalidation = invalidationCandidates.find((c) => c.price > currentPrice);
    if (!bullishInvalidation) {
        bullishInvalidation = invalidationCandidates[0];
        console.warn(`[risk] No bullish invalidation below current price ${currentPrice}. Using closest: ${bullishInvalidation.price}`);
    }
    if (!bearishInvalidation) {
        bearishInvalidation = invalidationCandidates[0];
        console.warn(`[risk] No bearish invalidation above current price ${currentPrice}. Using closest: ${bearishInvalidation.price}`);
    }
    if (bullishInvalidation.price >= currentPrice) {
        console.warn(`[risk] VALIDATION: bullish invalidation ${bullishInvalidation.price} is NOT below current price ${currentPrice}`);
    }
    if (bearishInvalidation.price <= currentPrice) {
        console.warn(`[risk] VALIDATION: bearish invalidation ${bearishInvalidation.price} is NOT above current price ${currentPrice}`);
    }
    if (nearbyResistance && nearbyResistance.price > currentPrice) {
        const targetDistance = nearbyResistance.price - currentPrice;
        const invalidationDistance = Math.abs(currentPrice - bullishInvalidation.price);
        const ratio = invalidationDistance > 0 ? (targetDistance / invalidationDistance).toFixed(2) : '0.00';
        scenarios.push({
            direction: 'bullish',
            entryReference: currentPrice,
            invalidation: {
                price: bullishInvalidation.price,
                distanceInATR: bullishInvalidation.distanceInATR,
            },
            target: {
                price: nearbyResistance.price,
                strength: nearbyResistance.strength,
                distanceInATR: nearbyResistance.distanceInATR,
            },
            ratio,
        });
    }
    if (nearbySupport && nearbySupport.price < currentPrice) {
        const targetDistance = currentPrice - nearbySupport.price;
        const invalidationDistance = Math.abs(currentPrice - bearishInvalidation.price);
        const ratio = invalidationDistance > 0 ? (targetDistance / invalidationDistance).toFixed(2) : '0.00';
        scenarios.push({
            direction: 'bearish',
            entryReference: currentPrice,
            invalidation: {
                price: bearishInvalidation.price,
                distanceInATR: bearishInvalidation.distanceInATR,
            },
            target: {
                price: nearbySupport.price,
                strength: nearbySupport.strength,
                distanceInATR: nearbySupport.distanceInATR,
            },
            ratio,
        });
    }
    return scenarios;
}
function calculatePositionSizing(accountSize, maxRiskPercent, invalidationCandidates, currentPrice, symbol, atr) {
    if (accountSize <= 0 || maxRiskPercent <= 0)
        return null;
    if (invalidationCandidates.length === 0)
        return null;
    const clampedRiskPercent = Math.max(DEFAULT_MIN_RISK_PERCENT, Math.min(DEFAULT_MAX_RISK_PERCENT, maxRiskPercent));
    const unusuallyHighRisk = maxRiskPercent > 10;
    const riskAmount = accountSize * (clampedRiskPercent / 100);
    const primaryInvalidation = invalidationCandidates[0];
    const riskDistance = Math.abs(currentPrice - primaryInvalidation.price);
    const config = (0, instrumentConfig_1.getInstrumentConfig)(symbol);
    const pipValue = config.pipValue;
    const lotSize = config.lotSize;
    if (pipValue <= 0 || riskDistance <= 0)
        return null;
    const riskDistanceInPips = riskDistance / pipValue;
    const positionSizeUnits = riskAmount / riskDistance;
    const positionSizeLots = lotSize > 0 ? positionSizeUnits / lotSize : 0;
    return {
        riskAmount: Math.round(riskAmount * 100) / 100,
        riskDistanceInPips: Math.round(riskDistanceInPips * 100) / 100,
        positionSizeUnits: Math.round(positionSizeUnits),
        positionSizeLots: Math.round(positionSizeLots * 10000) / 10000,
        basedOnInvalidation: primaryInvalidation.price,
        unusuallyHighRisk,
    };
}
//# sourceMappingURL=riskAnalysisEngine.js.map