/**
 * Trading Terminal Broker Configuration
 * Minimal implementation to enable Trading Terminal features (position lines, order display, etc.)
 *
 * This is a minimal broker API implementation that enables Trading Terminal UI features
 * without implementing full order/position management functionality.
 *
 * For now, this just returns empty arrays - actual trading is handled through smart contracts.
 */

export interface BrokerAccount {
  id: string;
  name: string;
  currency?: string;
}

/**
 * Minimal Broker Configuration
 * This enables Trading Terminal features like createPositionLine()
 */
export const brokerConfig = {
  configFlags: {
    // CRITICAL: Must be true to enable createPositionLine() API
    // This enables Trading Platform mode which provides the position line APIs
    supportPositions: true,

    // Disable trading features we don't need yet
    supportOrderBrackets: false,
    supportPositionBrackets: false,
    supportClosePosition: false,
    supportReversePosition: false,

    // Disable order types (we handle orders through smart contracts)
    supportMarketOrders: false,
    supportLimitOrders: false,
    supportStopOrders: false,
    supportStopLimitOrders: false,

    // We calculate P&L ourselves
    supportPLUpdate: false,

    // Disable Level 2 data for now
    supportLevel2Data: false,

    // Single position per instrument
    supportMultiposition: false,

    // Try enabling DOM (Depth of Market) support as it might be required
    supportDOM: true,
  },
};

/**
 * Minimal broker factory function
 * Returns a broker terminal implementation with minimal functionality
 *
 * This is required by Trading Terminal but we're not using the Account Manager,
 * so we return minimal implementations.
 */
export function createBrokerTerminal() {
  return {
    // Account Manager methods (minimal implementation)

    /**
     * Returns account manager configuration
     */
    accountManagerInfo() {
      return {
        accountTitle: "DotMX Account",
        summary: [],
        orderColumns: [],
        positionColumns: [],
        pages: [],
        possibleOrderStatuses: [],
      };
    },

    /**
     * Returns accounts metadata
     */
    async accountsMetainfo() {
      return [];
    },

    /**
     * Returns current account ID
     */
    currentAccount() {
      return "default" as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    },

    /**
     * Returns connection status (1 = connected)
     */
    connectionStatus() {
      return 1; // Connected
    },

    /**
     * Check if a symbol is tradable
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async isTradable(_symbol: string) {
      return true; // All symbols tradable through smart contracts
    },

    /**
     * Returns list of orders
     */
    async orders() {
      return [];
    },

    /**
     * Returns list of positions (not used - we display via createPositionLine)
     */
    async positions() {
      return [];
    },

    /**
     * Returns list of executions
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async executions(_symbol: string) {
      return [];
    },

    /**
     * Returns symbol information for Order Ticket
     */
    async symbolInfo(symbol: string) {
      // Return minimal symbol info
      return {
        name: symbol,
        description: symbol,
        currency: "USDC",
        pipSize: 0.01,
        pipValue: 0.01,
        minTick: 0.01,
        lotSize: 0.001,
        qty: {
          min: 0.001,
          max: 1000,
          step: 0.001,
          default: 0.1,
        },
      };
    },

    /**
     * Context menu actions (return empty to hide Trade menu)
     */
    async chartContextMenuActions() {
      return []; // No trade menu actions
    },

    // Required trading methods (minimal stubs - we use smart contracts)

    /**
     * Place order (stub - we use smart contracts)
     */
    async placeOrder() {
      throw new Error("Use smart contract interface to place orders");
    },

    /**
     * Modify order (stub)
     */
    async modifyOrder() {
      throw new Error("Use smart contract interface to modify orders");
    },

    /**
     * Cancel order (stub)
     */
    async cancelOrder() {
      throw new Error("Use smart contract interface to cancel orders");
    },

    // Subscribe methods (no-ops - we handle updates ourselves)

    subscribeOrders() {
      // No-op: We handle orders through smart contracts
    },

    subscribePositions() {
      // No-op: We handle positions through PositionService
    },

    subscribeExecutions() {
      // No-op
    },

    unsubscribeOrders() {
      // No-op
    },

    unsubscribePositions() {
      // No-op
    },

    unsubscribeExecutions() {
      // No-op
    },
  };
}
