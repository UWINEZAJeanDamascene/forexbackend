import { describe, expect, it } from 'vitest';
import { validateAiText, validateStructuredAiResponse } from './aiResponseValidator';

describe('validateAiText', () => {
  it.each([
    'This is guaranteed to work.',
    'The price will definitely rise.',
    'There is a 90% chance of profit.',
    'Buy now, this is a sure thing.',
    "You can't lose on this setup.",
  ])('rejects unsafe language: %s', (text) => {
    expect(validateAiText(text).valid).toBe(false);
  });

  it('accepts cautious scenario language', () => {
    expect(validateAiText('Technical conditions currently favor a cautious interpretation. One possible scenario is a continuation after confirmation.').valid).toBe(true);
  });

  it('accepts a negated educational disclaimer containing guaranteed', () => {
    expect(validateAiText('This analysis is not guaranteed and is not financial advice.').valid).toBe(true);
  });

  it('accepts the exact structured schema and rejects malformed output', () => {
    const valid = JSON.stringify({
      summary: 'Wait for confirmation because evidence is not aligned.', trend: 'neutral', momentum: 'neutral', marketStructure: 'range',
      keyLevels: ['support 1.1000'], bullishScenario: 'One possible scenario is a confirmed break higher.', bearishScenario: 'One possible scenario is a confirmed break lower.',
      confirmationNeeded: ['confirmation'], invalidationConditions: ['close below support'], riskFactors: ['volatility'], confidence: 42,
    });
    expect(validateStructuredAiResponse(valid).valid).toBe(true);
    expect(validateStructuredAiResponse('{"summary":"missing fields"}').valid).toBe(false);
    expect(validateStructuredAiResponse(valid.replace('"confidence":42', '"confidence":142')).valid).toBe(false);
  });
});
