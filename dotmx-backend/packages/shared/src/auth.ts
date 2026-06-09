/**
 * Authentication Module Exports
 */

// Types
export * from './types/auth';

// Services
export { AuthService } from './services/auth.service';
export type { AuthConfig } from './services/auth.service';
export { WalletAuthService } from './services/wallet-auth.service';
export { DatabaseService } from './services/database';
export type { DatabaseConfig } from './services/database';
export { createEmailService } from './services/email.service';
export type { EmailService, EmailConfig } from './services/email.service';

// Middleware
export {
  authPlugin,
  apiKeyPlugin,
  getUser,
  hasRole,
  hasPermission,
} from './middleware/auth.middleware';
export type { AuthContext, ApiKeyContext } from './middleware/auth.middleware';
