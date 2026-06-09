/**
 * Environment Variables Configuration and Validation
 * Centralized management of environment variables used in the frontend application
 */

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface EnvConfig {
  // Development/Production flags
  isDevelopment: boolean;
  isProduction: boolean;
  enableTestnet: boolean;
  chartDebug: boolean;
}

// =============================================================================
// ENVIRONMENT VARIABLE PARSING
// =============================================================================

/**
 * Parse and validate all environment variables
 * Provides type-safe access to env vars with proper validation and defaults
 */
export const getEnvConfig = (): EnvConfig => {
  const nodeEnv = process.env.NODE_ENV || "development";

  return {
    // Environment flags
    isDevelopment: nodeEnv === "development",
    isProduction: nodeEnv === "production",
    enableTestnet: process.env.NEXT_PUBLIC_ENABLE_TESTNET === "true",
    chartDebug: process.env.NEXT_PUBLIC_CHART_DEBUG === "true",
  };
};

/**
 * Validate required environment variables for the current configuration
 */
export const validateEnvironment = () => {
  const env = getEnvConfig();
  const errors: string[] = [];

  // No required env vars for basic frontend - API URLs have defaults
  // in services that use them (TradingViewDatafeed, ApiClient, etc.)

  return {
    valid: errors.length === 0,
    errors,
    env,
  };
};

/**
 * Enhanced environment validation with detailed reporting
 */
export const logEnvironmentStatus = () => {
  const validation = validateEnvironment();
  const { env } = validation;

  console.warn("🔧 Environment Configuration:");
  console.warn(
    `  📊 Mode: ${env.isDevelopment ? "Development" : "Production"}`
  );
  console.warn(`  🧪 Testnet: ${env.enableTestnet ? "Enabled" : "Disabled"}`);
  console.warn(`  📊 Chart Debug: ${env.chartDebug ? "Enabled" : "Disabled"}`);

  // Only log errors if there are any
  if (!validation.valid) {
    console.error("❌ Environment validation failed:");
    validation.errors.forEach((error) => console.error(`  • ${error}`));
  }

  // Success message if no errors
  if (validation.valid && validation.errors.length === 0) {
    console.warn("✨ All environment variables are properly configured!");
  }

  return validation;
};

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

// Create singleton instance
export const env = getEnvConfig();

// Export validation function as default
export default validateEnvironment;
