import { Candle, Quote } from '../../../shared/types/market';
import { Symbol, Timeframe } from '../../../shared/constants/instruments';
import { MarketDataError, MarketDataProvider } from './MarketDataProvider';

function isForexSymbol(symbol: Symbol): boolean {
  return symbol !== 'XAU/USD';
}

export class FallbackProvider implements MarketDataProvider {
  readonly name = 'fallback';

  private readonly providers: MarketDataProvider[];

  constructor(providers: MarketDataProvider[]) {
    if (providers.length === 0) {
      throw new Error('FallbackProvider requires at least one provider.');
    }
    this.providers = providers;
  }

  getSupportedSymbols(): Symbol[] {
    const symbolSet = new Set<Symbol>();
    for (const provider of this.providers) {
      for (const symbol of provider.getSupportedSymbols()) {
        symbolSet.add(symbol);
      }
    }
    return Array.from(symbolSet);
  }

  getSupportedTimeframes(): Timeframe[] {
    const timeframeSet = new Set<Timeframe>();
    for (const provider of this.providers) {
      for (const timeframe of provider.getSupportedTimeframes()) {
        timeframeSet.add(timeframe);
      }
    }
    return Array.from(timeframeSet);
  }

  readonly supportsForex = true;

  async getQuote(symbol: Symbol): Promise<Quote> {
    return this.executeWithFallback((provider) => provider.getQuote(symbol), symbol);
  }

  async getCandles(
    symbol: Symbol,
    timeframe: Timeframe,
    limit?: number
  ): Promise<Candle[]> {
    return this.executeWithFallback((provider) => provider.getCandles(symbol, timeframe, limit), symbol);
  }

  async getHistoricalData(
    symbol: Symbol,
    timeframe: Timeframe,
    from: Date,
    to: Date
  ): Promise<Candle[]> {
    return this.executeWithFallback((provider) => provider.getHistoricalData(symbol, timeframe, from, to), symbol);
  }

  private async executeWithFallback<T>(operation: (provider: MarketDataProvider) => Promise<T>, symbol: Symbol): Promise<T> {
    const errors: MarketDataError[] = [];

    for (const provider of this.providers) {
      if (isForexSymbol(symbol) && provider.supportsForex === false) {
        continue;
      }

      try {
        return await operation(provider);
      } catch (error) {
        if (error instanceof MarketDataError && this.isRetryable(error)) {
          errors.push(error);
          continue;
        }
        throw error;
      }
    }

    const lastError = errors[errors.length - 1];
    if (lastError) {
      throw lastError;
    }

    throw new MarketDataError(
      'PROVIDER_ERROR',
      this.name,
      'All providers failed and no errors were captured.'
    );
  }

  private isRetryable(error: MarketDataError): boolean {
    switch (error.kind) {
      case 'RATE_LIMIT':
      case 'NETWORK_ERROR':
      case 'PROVIDER_ERROR':
      case 'CONFIG_ERROR':
        return true;
      case 'INVALID_RESPONSE':
      case 'UNSUPPORTED_SYMBOL':
      case 'UNSUPPORTED_TIMEFRAME':
      default:
        return false;
    }
  }
}
