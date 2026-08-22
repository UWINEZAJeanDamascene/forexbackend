import { Quote } from '../../../shared/types/market';
import { Symbol } from '../../../shared/constants/instruments';
import { getMarketDataProvider } from '../providers';

const QUOTE_CACHE_TTL_MS = 30_000;
const quoteCache = new Map<string, { quote: Quote; expiresAt: number }>();

export async function getCachedQuote(symbol: Symbol): Promise<Quote> {
  const cached = quoteCache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) return cached.quote;

  const quote = await getMarketDataProvider().getQuote(symbol);
  quoteCache.set(symbol, { quote, expiresAt: Date.now() + QUOTE_CACHE_TTL_MS });
  return quote;
}

export function clearQuoteCache(): void {
  quoteCache.clear();
}
