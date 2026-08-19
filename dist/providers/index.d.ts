import { MarketDataProvider } from './MarketDataProvider';
/**
 * The rest of the app should call this instead of importing a concrete
 * provider class. Swapping providers later means changing this function
 * only - no other file should import TwelveDataProvider directly.
 */
export declare function getMarketDataProvider(): MarketDataProvider;
/** Test-only escape hatch to reset the cached singleton between tests. */
export declare function _resetMarketDataProviderForTests(): void;
export type { MarketDataProvider } from './MarketDataProvider';
export { MarketDataError } from './MarketDataProvider';
export type { MarketDataErrorKind } from './MarketDataProvider';
