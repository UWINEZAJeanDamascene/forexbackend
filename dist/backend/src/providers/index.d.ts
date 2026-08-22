import { MarketDataProvider } from './MarketDataProvider';
export declare function getMarketDataProvider(): MarketDataProvider;
/** Test-only escape hatch to reset the cached singleton between tests. */
export declare function _resetMarketDataProviderForTests(): void;
export type { MarketDataProvider } from './MarketDataProvider';
export { MarketDataError } from './MarketDataProvider';
export type { MarketDataErrorKind } from './MarketDataProvider';
