/**
 * @dotmx/shared
 * Shared types, utilities, and constants across all packages
 */

export * from "./types";
export * from "./utils";
export * from "./constants";
export * from "./errors";
export * from "./logging";
export * from "./config";
export * from "./health";

// Services
export { AccountSecurityService } from "./services/account-security.service";
export { DatabaseService, type DatabaseConfig } from "./services/database";
export { AuthService } from "./services/auth.service";

// Custodial Wallet Services
export { GCPKMSService, createGCPKMSService } from "./services/gcp-kms.service";
export { HDWalletService, createHDWalletService } from "./services/hd-wallet.service";
export { SweeperService, createSweeperService } from "./services/sweeper.service";
export { WithdrawalService, createWithdrawalService } from "./services/withdrawal.service";

// Alchemy Webhook Service
export { AlchemyWebhookService } from "./services/alchemy-webhook.service";
export { DepositConfirmationService, createDepositConfirmationService } from "./services/deposit-confirmation.service";
export * from "./types/alchemy";

// Trade Settlement Service
export { TradeSettlementService, createTradeSettlementService, type TradeToSettle, type SettlementResult } from "./services/trade-settlement.service";

// Wallet Routes
export { createWalletRoutes, createAdminWalletRoutes } from "./routes/wallet.routes";
