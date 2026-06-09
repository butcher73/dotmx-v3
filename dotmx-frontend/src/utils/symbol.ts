/**
 * Symbol Utilities
 *
 * Canonical symbol format: "BTC-USDT" (dash-separated, USDT quote)
 *
 * All internal code should use this format. Conversions happen only at
 * boundaries: Bitget API calls, chart widget, etc.
 */

/**
 * Parse a symbol string into its base and quote components.
 * Handles: "BTC-USDT", "BTC/USDT", "BTCUSDT", "BTCUSDT_UMCBL"
 */
export function parseSymbol(symbol: string): { base: string; quote: string } {
  if (!symbol) return { base: "", quote: "" };

  // Strip Bitget contract suffixes
  const clean = symbol.replace(/_UMCBL$|_DMCBL$|_CMCBL$/i, "");

  // Dash-separated: "BTC-USDT"
  if (clean.includes("-")) {
    const [base, quote] = clean.split("-");
    return { base: base!, quote: quote! };
  }

  // Slash-separated: "BTC/USDT"
  if (clean.includes("/")) {
    const [base, quote] = clean.split("/");
    return { base: base!, quote: quote! };
  }

  // Flat format: "BTCUSDT", "ETHUSDC", "ETHBTC"
  const KNOWN_QUOTES = ["USDT", "USDC", "BTC", "ETH", "USD"];
  for (const q of KNOWN_QUOTES) {
    if (clean.endsWith(q) && clean.length > q.length) {
      return { base: clean.slice(0, -q.length), quote: q };
    }
  }

  return { base: clean, quote: "USDT" };
}

/**
 * Convert any symbol format to the canonical internal format: "BTC-USDT"
 */
export function toInternalSymbol(symbol: string): string {
  const { base, quote } = parseSymbol(symbol);
  if (!base) return symbol;
  return `${base}-${quote}`;
}

/**
 * Convert any symbol format to flat exchange format: "BTCUSDT"
 * Used for Bitget/Binance API calls, WS subscriptions, URL params.
 */
export function toExchangeSymbol(symbol: string): string {
  const { base, quote } = parseSymbol(symbol);
  if (!base) return symbol;
  return `${base}${quote}`;
}

/**
 * Extract the base asset from any symbol format.
 */
export function getBaseAsset(symbol: string): string {
  return parseSymbol(symbol).base;
}

/**
 * Extract the quote asset from any symbol format.
 */
export function getQuoteAsset(symbol: string): string {
  return parseSymbol(symbol).quote;
}

/**
 * Check if two symbols refer to the same trading pair,
 * regardless of format.
 */
export function symbolsMatch(a: string, b: string): boolean {
  return toExchangeSymbol(a) === toExchangeSymbol(b);
}
