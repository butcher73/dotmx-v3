/**
 * @dotmx/marketdata
 *
 * Module 09 — Market Data Pipeline
 * - L2 book builder from events
 * - Redis pub/sub fanout
 * - Throttled WebSocket broadcasting
 * - External price feeds (Binance, Bitget)
 * - Ticker aggregation (24h stats)
 * - Kline/candlestick aggregation
 * - Mark price calculation
 * - Delta hedging engine (A-Book)
 */

export * from "./builder";
export * from "./fanout";
export * from "./throttle";
export * from "./external";
export * from "./datasource";
export * from "./ticker";
export * from "./kline";
export * from "./markprice";
export * from "./hedge";
export * from "./persistence";
