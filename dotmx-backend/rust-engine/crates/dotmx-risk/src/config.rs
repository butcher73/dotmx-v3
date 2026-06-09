//! Risk configuration for markets and users

use dotmx_core::{Decimal, Symbol, to_decimal};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Risk configuration for a specific market
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketRiskConfig {
    /// Symbol this config applies to
    pub symbol: Symbol,
    
    /// Minimum order size (base asset)
    pub min_order_size: Decimal,
    
    /// Maximum order size (base asset)
    pub max_order_size: Decimal,
    
    /// Maximum notional value per order (quote asset)
    pub max_notional: Decimal,
    
    /// Maximum percentage deviation from reference price (e.g., 0.10 = 10%)
    pub price_deviation_threshold: f64,
    
    /// Tick size (minimum price increment)
    pub tick_size: Decimal,
    
    /// Lot size (minimum quantity increment)
    pub lot_size: Decimal,
    
    /// Whether the market is currently tradeable
    pub is_active: bool,
    
    /// Maximum open orders per user
    pub max_open_orders_per_user: u32,
}

impl Default for MarketRiskConfig {
    fn default() -> Self {
        Self {
            symbol: Symbol::new("BTC-USDT"),
            min_order_size: to_decimal(0.0001),
            max_order_size: to_decimal(100.0),
            max_notional: to_decimal(10_000_000.0),
            price_deviation_threshold: 0.10,
            tick_size: to_decimal(0.01),
            lot_size: to_decimal(0.0001),
            is_active: true,
            max_open_orders_per_user: 100,
        }
    }
}

impl MarketRiskConfig {
    pub fn new(symbol: impl AsRef<str>) -> Self {
        Self {
            symbol: Symbol::new(symbol),
            ..Default::default()
        }
    }

    /// Builder pattern for min/max order size
    pub fn with_order_size_limits(mut self, min: f64, max: f64) -> Self {
        self.min_order_size = to_decimal(min);
        self.max_order_size = to_decimal(max);
        self
    }

    /// Builder pattern for max notional
    pub fn with_max_notional(mut self, max: f64) -> Self {
        self.max_notional = to_decimal(max);
        self
    }

    /// Builder pattern for price deviation
    pub fn with_price_deviation(mut self, threshold: f64) -> Self {
        self.price_deviation_threshold = threshold;
        self
    }

    /// Builder pattern for tick/lot size
    pub fn with_tick_lot_size(mut self, tick: f64, lot: f64) -> Self {
        self.tick_size = to_decimal(tick);
        self.lot_size = to_decimal(lot);
        self
    }
}

/// Risk configuration for a specific user
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserRiskConfig {
    /// Maximum total notional across all open orders
    pub max_total_notional: Decimal,
    
    /// Maximum number of open orders across all markets
    pub max_open_orders: u32,
    
    /// Maximum orders per second (rate limit)
    pub orders_per_second: u32,
    
    /// Whether the user is allowed to trade
    pub is_enabled: bool,
    
    /// Position limits per market (optional)
    pub position_limits: HashMap<String, PositionLimit>,
}

impl Default for UserRiskConfig {
    fn default() -> Self {
        Self {
            max_total_notional: to_decimal(100_000_000.0),
            max_open_orders: 1000,
            orders_per_second: 100,
            is_enabled: true,
            position_limits: HashMap::new(),
        }
    }
}

/// Position limits for a specific market
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PositionLimit {
    /// Maximum long position size
    pub max_long: Decimal,
    /// Maximum short position size
    pub max_short: Decimal,
}

impl Default for PositionLimit {
    fn default() -> Self {
        Self {
            max_long: to_decimal(1000.0),
            max_short: to_decimal(1000.0),
        }
    }
}

/// Global risk configuration manager
#[derive(Debug, Clone)]
pub struct RiskConfigManager {
    /// Market-specific risk configs
    pub markets: HashMap<String, MarketRiskConfig>,
    
    /// Default config for unknown markets
    pub default_market_config: MarketRiskConfig,
    
    /// User-specific risk configs
    pub users: HashMap<String, UserRiskConfig>,
    
    /// Default config for unknown users
    pub default_user_config: UserRiskConfig,
}

impl Default for RiskConfigManager {
    fn default() -> Self {
        Self::new()
    }
}

impl RiskConfigManager {
    pub fn new() -> Self {
        Self {
            markets: HashMap::new(),
            default_market_config: MarketRiskConfig::default(),
            users: HashMap::new(),
            default_user_config: UserRiskConfig::default(),
        }
    }

    /// Add or update market risk config
    pub fn set_market_config(&mut self, config: MarketRiskConfig) {
        self.markets.insert(config.symbol.to_string(), config);
    }

    /// Get market risk config (returns default if not found)
    pub fn get_market_config(&self, symbol: &str) -> &MarketRiskConfig {
        self.markets.get(symbol).unwrap_or(&self.default_market_config)
    }

    /// Add or update user risk config
    pub fn set_user_config(&mut self, user_id: &str, config: UserRiskConfig) {
        self.users.insert(user_id.to_string(), config);
    }

    /// Get user risk config (returns default if not found)
    pub fn get_user_config(&self, user_id: &str) -> &UserRiskConfig {
        self.users.get(user_id).unwrap_or(&self.default_user_config)
    }

    /// Check if a market is active
    pub fn is_market_active(&self, symbol: &str) -> bool {
        self.get_market_config(symbol).is_active
    }

    /// Check if a user is enabled
    pub fn is_user_enabled(&self, user_id: &str) -> bool {
        self.get_user_config(user_id).is_enabled
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use dotmx_core::from_decimal;

    #[test]
    fn test_default_market_config() {
        let config = MarketRiskConfig::default();
        assert_eq!(config.symbol, Symbol::new("BTC-USDT"));
        assert!(config.is_active);
        assert_eq!(from_decimal(config.max_order_size), 100.0);
    }

    #[test]
    fn test_market_config_builder() {
        let config = MarketRiskConfig::new("ETH-USDT")
            .with_order_size_limits(0.01, 50.0)
            .with_max_notional(5_000_000.0)
            .with_price_deviation(0.05);

        assert_eq!(config.symbol, Symbol::new("ETH-USDT"));
        assert_eq!(from_decimal(config.min_order_size), 0.01);
        assert_eq!(from_decimal(config.max_order_size), 50.0);
        assert_eq!(config.price_deviation_threshold, 0.05);
    }

    #[test]
    fn test_risk_config_manager() {
        let mut manager = RiskConfigManager::new();
        
        let btc_config = MarketRiskConfig::new("BTC-USDT")
            .with_max_notional(10_000_000.0);
        manager.set_market_config(btc_config);

        let config = manager.get_market_config("BTC-USDT");
        assert_eq!(from_decimal(config.max_notional), 10_000_000.0);

        // Unknown market should return default
        let unknown = manager.get_market_config("UNKNOWN");
        assert_eq!(unknown.symbol, Symbol::new("BTC-USDT")); // Default symbol
    }
}
