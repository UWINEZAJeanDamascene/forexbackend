import { Quote } from '../../../shared/types/market';
import { Symbol } from '../../../shared/constants/instruments';
export declare function getCachedQuote(symbol: Symbol): Promise<Quote>;
export declare function clearQuoteCache(): void;
