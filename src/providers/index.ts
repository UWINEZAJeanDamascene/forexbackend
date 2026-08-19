import { env } from '../config/env';
import { MarketDataProvider } from './MarketDataProvider';
import { TwelveDataProvider } from './twelveData/TwelveDataProvider';

let cachedProvider: MarketDataProvider | undefined;

/**
 * The rest of the app should call this instead of importing a concrete
 * provider class. Swapping providers later means changing this function
 * only - no other file should import TwelveDataProvider directly.
 */
export function getMarketDataProvider(): MarketDataProvider {
  if (!cachedProvider) {
    cachedProvider = new TwelveDataProvider({ apiKey: env.twelveDataApiKey });
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
