//! Pre-trade risk checks

use crate::config::{MarketRiskConfig, UserRiskConfig};
use dotmx_core::{Decimal, Order, OrderType, from_decimal, mul_decimal};
use serde::{Deserialize, Serialize};
use tracing::{debug, warn};

/// Result of a risk check
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum RiskCheckResult {
    /// Order passed all risk checks
    Passed,
    /// Order failed risk checks
    Failed(RiskRejection),
}

impl RiskCheckResult {
    pub fn is_passed(&self) -> bool {
        matches!(self, RiskCheckResult::Passed)
    }

    pub fn is_failed(&self) -> bool {
        !self.is_passed()
    }
}

/// Reason for risk rejection
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RiskRejection {
    /// Market is not active for trading
    MarketInactive { symbol: String },
    
    /// User is not enabled for trading
    UserDisabled { user_id: String },
    
    /// Order size is below minimum
    OrderSizeTooSmall { 
        size: Decimal, 
        min_size: Decimal 
    },
    
    /// Order size exceeds maximum
    OrderSizeTooLarge { 
        size: Decimal, 
        max_size: Decimal 
    },
    
    /// Order notional exceeds maximum
    NotionalTooLarge { 
        notional: Decimal, 
        max_notional: Decimal 
    },
    
    /// Price deviates too much from reference
    PriceDeviation { 
        price: Decimal, 
        reference_price: Decimal, 
        deviation: f64,
        max_deviation: f64 
    },
    
    /// Price not aligned to tick size
    InvalidTickSize { 
        price: Decimal, 
        tick_size: Decimal 
    },
    
    /// Quantity not aligned to lot size
    InvalidLotSize { 
        quantity: Decimal, 
        lot_size: Decimal 
    },
    
    /// Too many open orders
    TooManyOpenOrders { 
        current: u32, 
        max: u32 
    },
    
    /// Position limit exceeded
    PositionLimitExceeded { 
        current_position: Decimal, 
        new_position: Decimal, 
        limit: Decimal 
    },
    
    /// Rate limit exceeded
    RateLimitExceeded { 
        requests_per_second: u32, 
        limit: u32 
    },
    
    /// Invalid order (general validation failure)
    InvalidOrder { message: String },
}

impl std::fmt::Display for RiskRejection {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RiskRejection::MarketInactive { symbol } => {
                write!(f, "Market {} is not active", symbol)
            }
            RiskRejection::UserDisabled { user_id } => {
                write!(f, "User {} is disabled", user_id)
            }
            RiskRejection::OrderSizeTooSmall { size, min_size } => {
                write!(f, "Order size {} below minimum {}", from_decimal(*size), from_decimal(*min_size))
            }
            RiskRejection::OrderSizeTooLarge { size, max_size } => {
                write!(f, "Order size {} exceeds maximum {}", from_decimal(*size), from_decimal(*max_size))
            }
            RiskRejection::NotionalTooLarge { notional, max_notional } => {
                write!(f, "Notional {} exceeds maximum {}", from_decimal(*notional), from_decimal(*max_notional))
            }
            RiskRejection::PriceDeviation { deviation, max_deviation, .. } => {
                write!(f, "Price deviation {:.2}% exceeds maximum {:.2}%", deviation * 100.0, max_deviation * 100.0)
            }
            RiskRejection::InvalidTickSize { price, tick_size } => {
                write!(f, "Price {} not aligned to tick size {}", from_decimal(*price), from_decimal(*tick_size))
            }
            RiskRejection::InvalidLotSize { quantity, lot_size } => {
                write!(f, "Quantity {} not aligned to lot size {}", from_decimal(*quantity), from_decimal(*lot_size))
            }
            RiskRejection::TooManyOpenOrders { current, max } => {
                write!(f, "Too many open orders: {} (max {})", current, max)
            }
            RiskRejection::PositionLimitExceeded { limit, .. } => {
                write!(f, "Position limit {} exceeded", from_decimal(*limit))
            }
            RiskRejection::RateLimitExceeded { requests_per_second, limit } => {
                write!(f, "Rate limit exceeded: {} req/s (max {})", requests_per_second, limit)
            }
            RiskRejection::InvalidOrder { message } => {
                write!(f, "Invalid order: {}", message)
            }
        }
    }
}

/// Risk checker for pre-trade validation
pub struct RiskChecker {
    market_config: MarketRiskConfig,
    user_config: UserRiskConfig,
}

impl RiskChecker {
    /// Create a new risk checker with the given configs
    pub fn new(market_config: MarketRiskConfig, user_config: UserRiskConfig) -> Self {
        Self {
            market_config,
            user_config,
        }
    }

    /// Run all risk checks on an order
    pub fn check_order(
        &self,
        order: &Order,
        reference_price: Option<Decimal>,
        current_open_orders: u32,
    ) -> RiskCheckResult {
        // Check market is active
        if !self.market_config.is_active {
            return RiskCheckResult::Failed(RiskRejection::MarketInactive {
                symbol: order.symbol.to_string(),
            });
        }

        // Check user is enabled
        if !self.user_config.is_enabled {
            return RiskCheckResult::Failed(RiskRejection::UserDisabled {
                user_id: order.user_id.to_string(),
            });
        }

        // Check order size
        if let Some(rejection) = self.check_order_size(order) {
            return RiskCheckResult::Failed(rejection);
        }

        // Check notional (for limit orders)
        if order.order_type == OrderType::Limit {
            if let Some(rejection) = self.check_notional(order) {
                return RiskCheckResult::Failed(rejection);
            }

            // Check price deviation
            if let Some(ref_price) = reference_price {
                if let Some(rejection) = self.check_price_deviation(order, ref_price) {
                    return RiskCheckResult::Failed(rejection);
                }
            }

            // Check tick size
            if let Some(rejection) = self.check_tick_size(order) {
                return RiskCheckResult::Failed(rejection);
            }
        }

        // Check lot size
        if let Some(rejection) = self.check_lot_size(order) {
            return RiskCheckResult::Failed(rejection);
        }

        // Check open orders limit
        if let Some(rejection) = self.check_open_orders(current_open_orders) {
            return RiskCheckResult::Failed(rejection);
        }

        debug!(order_id = %order.id, "Order passed risk checks");
        RiskCheckResult::Passed
    }

    /// Check order size limits
    fn check_order_size(&self, order: &Order) -> Option<RiskRejection> {
        if order.quantity < self.market_config.min_order_size {
            warn!(
                order_id = %order.id,
                size = order.quantity,
                min = self.market_config.min_order_size,
                "Order size too small"
            );
            return Some(RiskRejection::OrderSizeTooSmall {
                size: order.quantity,
                min_size: self.market_config.min_order_size,
            });
        }

        if order.quantity > self.market_config.max_order_size {
            warn!(
                order_id = %order.id,
                size = order.quantity,
                max = self.market_config.max_order_size,
                "Order size too large"
            );
            return Some(RiskRejection::OrderSizeTooLarge {
                size: order.quantity,
                max_size: self.market_config.max_order_size,
            });
        }

        None
    }

    /// Check notional value
    fn check_notional(&self, order: &Order) -> Option<RiskRejection> {
        let notional = mul_decimal(order.price, order.quantity);

        if notional > self.market_config.max_notional {
            warn!(
                order_id = %order.id,
                notional = notional,
                max = self.market_config.max_notional,
                "Notional too large"
            );
            return Some(RiskRejection::NotionalTooLarge {
                notional,
                max_notional: self.market_config.max_notional,
            });
        }

        None
    }

    /// Check price deviation from reference
    fn check_price_deviation(&self, order: &Order, reference_price: Decimal) -> Option<RiskRejection> {
        if reference_price == 0 {
            return None;
        }

        let deviation = ((order.price - reference_price) as f64 / reference_price as f64).abs();

        if deviation > self.market_config.price_deviation_threshold {
            warn!(
                order_id = %order.id,
                price = order.price,
                reference = reference_price,
                deviation = deviation,
                max = self.market_config.price_deviation_threshold,
                "Price deviation too large"
            );
            return Some(RiskRejection::PriceDeviation {
                price: order.price,
                reference_price,
                deviation,
                max_deviation: self.market_config.price_deviation_threshold,
            });
        }

        None
    }

    /// Check tick size alignment
    fn check_tick_size(&self, order: &Order) -> Option<RiskRejection> {
        let tick = self.market_config.tick_size;
        if tick > 0 && order.price % tick != 0 {
            return Some(RiskRejection::InvalidTickSize {
                price: order.price,
                tick_size: tick,
            });
        }
        None
    }

    /// Check lot size alignment
    fn check_lot_size(&self, order: &Order) -> Option<RiskRejection> {
        let lot = self.market_config.lot_size;
        if lot > 0 && order.quantity % lot != 0 {
            return Some(RiskRejection::InvalidLotSize {
                quantity: order.quantity,
                lot_size: lot,
            });
        }
        None
    }

    /// Check open orders limit
    fn check_open_orders(&self, current: u32) -> Option<RiskRejection> {
        let max = self.market_config.max_open_orders_per_user;
        if current >= max {
            return Some(RiskRejection::TooManyOpenOrders { current, max });
        }
        None
    }
}

/// Fast-path risk check (inline, minimal overhead)
/// Returns true if order passes basic sanity checks
#[inline]
pub fn fast_path_check(order: &Order, max_size: Decimal, min_size: Decimal) -> bool {
    order.quantity >= min_size 
        && order.quantity <= max_size 
        && order.quantity > 0
        && (order.order_type == OrderType::Market || order.price > 0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::MarketRiskConfig;
    use dotmx_core::{Symbol, UserId, TimeInForce, Side, to_decimal};

    fn create_test_order(price: f64, qty: f64) -> Order {
        Order::new_limit(
            UserId::new("user1"),
            Symbol::new("BTC-USDT"),
            Side::Buy,
            to_decimal(price),
            to_decimal(qty),
            TimeInForce::GTC,
            1,
        )
    }

    fn create_checker() -> RiskChecker {
        let market_config = MarketRiskConfig::new("BTC-USDT")
            .with_order_size_limits(0.0001, 100.0)
            .with_max_notional(10_000_000.0)
            .with_price_deviation(0.10)
            .with_tick_lot_size(0.01, 0.0001);

        let user_config = UserRiskConfig::default();

        RiskChecker::new(market_config, user_config)
    }

    #[test]
    fn test_order_passes_all_checks() {
        let checker = create_checker();
        let order = create_test_order(50000.0, 1.0);
        
        let result = checker.check_order(&order, Some(to_decimal(50000.0)), 0);
        assert!(result.is_passed());
    }

    #[test]
    fn test_order_size_too_small() {
        let checker = create_checker();
        let order = create_test_order(50000.0, 0.00001); // Below min 0.0001
        
        let result = checker.check_order(&order, None, 0);
        assert!(matches!(
            result,
            RiskCheckResult::Failed(RiskRejection::OrderSizeTooSmall { .. })
        ));
    }

    #[test]
    fn test_order_size_too_large() {
        let checker = create_checker();
        let order = create_test_order(50000.0, 200.0); // Above max 100.0
        
        let result = checker.check_order(&order, None, 0);
        assert!(matches!(
            result,
            RiskCheckResult::Failed(RiskRejection::OrderSizeTooLarge { .. })
        ));
    }

    #[test]
    fn test_notional_too_large() {
        let checker = create_checker();
        let order = create_test_order(200000.0, 100.0); // 20M notional > 10M max
        
        let result = checker.check_order(&order, Some(to_decimal(200000.0)), 0);
        assert!(matches!(
            result,
            RiskCheckResult::Failed(RiskRejection::NotionalTooLarge { .. })
        ));
    }

    #[test]
    fn test_price_deviation() {
        let checker = create_checker();
        let order = create_test_order(60000.0, 1.0); // 20% above reference
        
        let result = checker.check_order(&order, Some(to_decimal(50000.0)), 0);
        assert!(matches!(
            result,
            RiskCheckResult::Failed(RiskRejection::PriceDeviation { .. })
        ));
    }

    #[test]
    fn test_invalid_tick_size() {
        let checker = create_checker();
        let order = create_test_order(50000.005, 1.0); // Not aligned to 0.01 tick
        
        let result = checker.check_order(&order, None, 0);
        assert!(matches!(
            result,
            RiskCheckResult::Failed(RiskRejection::InvalidTickSize { .. })
        ));
    }

    #[test]
    fn test_too_many_open_orders() {
        let checker = create_checker();
        let order = create_test_order(50000.0, 1.0);
        
        let result = checker.check_order(&order, None, 100); // At limit
        assert!(matches!(
            result,
            RiskCheckResult::Failed(RiskRejection::TooManyOpenOrders { .. })
        ));
    }

    #[test]
    fn test_market_inactive() {
        let mut market_config = MarketRiskConfig::new("BTC-USDT");
        market_config.is_active = false;
        let checker = RiskChecker::new(market_config, UserRiskConfig::default());
        
        let order = create_test_order(50000.0, 1.0);
        let result = checker.check_order(&order, None, 0);
        
        assert!(matches!(
            result,
            RiskCheckResult::Failed(RiskRejection::MarketInactive { .. })
        ));
    }

    #[test]
    fn test_user_disabled() {
        let market_config = MarketRiskConfig::new("BTC-USDT");
        let mut user_config = UserRiskConfig::default();
        user_config.is_enabled = false;
        let checker = RiskChecker::new(market_config, user_config);
        
        let order = create_test_order(50000.0, 1.0);
        let result = checker.check_order(&order, None, 0);
        
        assert!(matches!(
            result,
            RiskCheckResult::Failed(RiskRejection::UserDisabled { .. })
        ));
    }

    #[test]
    fn test_fast_path_check() {
        let max = to_decimal(100.0);
        let min = to_decimal(0.001);
        
        let valid_order = create_test_order(50000.0, 1.0);
        assert!(fast_path_check(&valid_order, max, min));

        let too_small = create_test_order(50000.0, 0.0001);
        assert!(!fast_path_check(&too_small, max, min));

        let too_large = create_test_order(50000.0, 200.0);
        assert!(!fast_path_check(&too_large, max, min));
    }
}
