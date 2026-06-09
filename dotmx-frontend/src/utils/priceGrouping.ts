/**
 * Price grouping utilities for different perps
 * Handles proper precision and grouping for various asset classes
 */

export interface PriceGroupingConfig {
  tickSize: number;
  precision: number;
  groupSizes: number[];
  defaultGroup: number;
}

/**
 * Get price grouping configuration based on current price level
 * Uses automatic powers of 10 grouping system
 */
export function getPriceGroupingConfig(
  currentPrice: number
): PriceGroupingConfig {
  // For prices >= 100,000 (BTC, high-value assets)
  if (currentPrice >= 100000) {
    return {
      tickSize: 1,
      precision: 0,
      groupSizes: [1, 5, 10, 50, 100],
      defaultGroup: 10,
    };
  }

  // For prices >= 10,000 (BTC, ETH high range)
  if (currentPrice >= 10000) {
    return {
      tickSize: 1,
      precision: 0,
      groupSizes: [1, 5, 10, 50, 100],
      defaultGroup: 10,
    };
  }

  // For prices >= 1,000 (ETH, BNB)
  if (currentPrice >= 1000) {
    return {
      tickSize: 0.1,
      precision: 1,
      groupSizes: [0.1, 0.5, 1, 5, 10],
      defaultGroup: 1,
    };
  }

  // For prices >= 100 (mid-range assets)
  if (currentPrice >= 100) {
    return {
      tickSize: 0.01,
      precision: 2,
      groupSizes: [0.01, 0.1, 0.5, 1, 10],
      defaultGroup: 0.1,
    };
  }

  // For prices >= 10
  if (currentPrice >= 10) {
    return {
      tickSize: 0.1,
      precision: 1,
      groupSizes: [0.01, 0.1, 1],
      defaultGroup: 0.1,
    };
  }

  // For prices >= 1
  if (currentPrice >= 1) {
    return {
      tickSize: 0.01,
      precision: 2,
      groupSizes: [0.001, 0.01, 0.1],
      defaultGroup: 0.01,
    };
  }

  // For prices >= 0.1
  if (currentPrice >= 0.1) {
    return {
      tickSize: 0.001,
      precision: 3,
      groupSizes: [0.0001, 0.001, 0.01],
      defaultGroup: 0.001,
    };
  }

  // For prices >= 0.01
  if (currentPrice >= 0.01) {
    return {
      tickSize: 0.0001,
      precision: 4,
      groupSizes: [0.00001, 0.0001, 0.001],
      defaultGroup: 0.0001,
    };
  }

  // For very low value pairs (like SHIB, DOGE) < 0.01
  return {
    tickSize: 0.000001,
    precision: 6,
    groupSizes: [0.0000001, 0.000001, 0.00001],
    defaultGroup: 0.000001,
  };
}

/**
 * Group order book entries by price levels
 */
export function groupOrderBookByPrice(
  orders: Array<{ price: number; amount: number }>,
  groupSize: number,
  isAsk: boolean = false
): Array<{ price: number; amount: number; total: number; percentage: number }> {
  const grouped = new Map<number, number>();

  // Group orders by rounded price levels
  orders.forEach((order) => {
    const groupedPrice = isAsk
      ? Math.ceil(order.price / groupSize) * groupSize
      : Math.floor(order.price / groupSize) * groupSize;

    const existing = grouped.get(groupedPrice) || 0;
    grouped.set(groupedPrice, existing + order.amount);
  });

  // Convert to array and sort
  const groupedArray = Array.from(grouped.entries())
    .map(([price, amount]) => ({
      price,
      amount,
      total: 0, // Will be calculated after sorting
      percentage: 0, // Will be calculated after sorting
    }))
    .sort((a, b) => (isAsk ? a.price - b.price : b.price - a.price));

  // Calculate cumulative totals and percentages
  let cumulative = 0;
  const maxTotal = groupedArray.reduce((sum, order) => sum + order.amount, 0);

  groupedArray.forEach((order) => {
    cumulative += order.amount;
    order.total = cumulative;
    order.percentage = maxTotal > 0 ? (cumulative / maxTotal) * 100 : 0;
  });

  return groupedArray;
}

/**
 * Format price according to grouping configuration
 */
export function formatGroupedPrice(
  price: number,
  config: PriceGroupingConfig
): string {
  if (config.precision === 0) {
    return Math.round(price).toLocaleString("en-US");
  }

  return price.toLocaleString("en-US", {
    minimumFractionDigits: config.precision,
    maximumFractionDigits: config.precision,
  });
}

/**
 * Get appropriate price precision for display
 */
export function getPricePrecision(currentPrice: number): number {
  const config = getPriceGroupingConfig(currentPrice);
  return config.precision;
}

/**
 * Round price to appropriate tick size
 */
export function roundToTickSize(price: number, tickSize: number): number {
  return Math.round(price / tickSize) * tickSize;
}
