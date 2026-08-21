import { env } from '../config/env';
import { MarketDataProvider } from './MarketDataProvider';
import { TwelveDataProvider } from './twelveData/TwelveDataProvider';
import { FinnhubProvider } from './finnhub/FinnhubProvider';
import { FallbackProvider } from './FallbackProvider';

let cachedProvider: MarketDataProvider | undefined;

function buildProviders(): MarketDataProvider[] {
  const providers: MarketDataProvider[] = [];

  if (env.twelveDataApiKey) {
    providers.push(new TwelveDataProvider({ apiKey: env.twelveDataApiKey }));
  }

  if (env.finnhubApiKey) {
    providers.push(new FinnhubProvider({ apiKey: env.finnhubApiKey }));
  }

  if (providers.length === 0) {
    providers.push(new TwelveDataProvider({ apiKey: undefined }));
  }

  if (providers.length === 1) {
    return providers;
  }

  return [new FallbackProvider(providers)];
}

export function getMarketDataProvider(): MarketDataProvider {
  if (!cachedProvider) {
    cachedProvider = buildProviders()[0]!;
  }
  return cachedProvider;
}

/** Test-only escape hatch to reset the cached singleton between tests. */
export function _resetMarketDataProviderForTests(): void {
  cachedProvider = undefined;
}

export type { MarketDataProvider } from './MarketDataProvider';
export { MarketDataError } from './MarketDataProvider';
export type { MarketDataErrorKind } from './MarketDataProvider';
