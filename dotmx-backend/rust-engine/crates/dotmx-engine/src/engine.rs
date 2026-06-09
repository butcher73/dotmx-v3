//! Core engine logic - Market shard handling

use dashmap::DashMap;
use dotmx_core::{
    EngineCommand, EngineEvent, MatchResult, MatchingEngine, Order,
    PlaceOrderCommand, CancelOrderCommand, Symbol,
    OrderAcceptedEvent, OrderRejectedEvent, OrderFilledEvent, OrderCancelledEvent,
    TradeExecutedEvent, CancelReason,
    CircuitBreaker, MarketState,
};
use dotmx_risk::{MarketRiskConfig, UserRiskConfig, RiskChecker, RiskCheckResult, OpenOrderTracker};
use parking_lot::RwLock;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};
use std::sync::Arc;
use tracing::{info, warn};

/// A market shard handles one symbol's orderbook and matching
pub struct MarketShard {
    symbol: Symbol,
    engine: MatchingEngine,
    risk_config: RwLock<MarketRiskConfig>,
    user_configs: DashMap<String, UserRiskConfig>,
    default_user_config: RwLock<UserRiskConfig>,
    open_orders: OpenOrderTracker,
    circuit_breaker: Arc<CircuitBreaker>,
    event_sequence: AtomicU64,
}

impl MarketShard {
    /// Create a new market shard
    pub fn new(symbol: impl AsRef<str>) -> Self {
        let symbol = Symbol::new(symbol);
        Self {
            engine: MatchingEngine::new(symbol.clone()),
            symbol,
            risk_config: RwLock::new(MarketRiskConfig::default()),
            user_configs: DashMap::new(),
            default_user_config: RwLock::new(UserRiskConfig::default()),
            open_orders: OpenOrderTracker::new(),
            circuit_breaker: Arc::new(CircuitBreaker::default()),
            event_sequence: AtomicU64::new(0),
        }
    }

    /// Create with specific risk config
    pub fn with_risk_config(symbol: impl AsRef<str>, config: MarketRiskConfig) -> Self {
        let symbol = Symbol::new(symbol);
        Self {
            engine: MatchingEngine::new(symbol.clone()),
            symbol,
            risk_config: RwLock::new(config),
            user_configs: DashMap::new(),
            default_user_config: RwLock::new(UserRiskConfig::default()),
            open_orders: OpenOrderTracker::new(),
            circuit_breaker: Arc::new(CircuitBreaker::default()),
            event_sequence: AtomicU64::new(0),
        }
    }

    /// Create with a Symbol and risk config (no re-hashing)
    pub fn with_symbol(symbol: Symbol, config: MarketRiskConfig) -> Self {
        Self {
            engine: MatchingEngine::new(symbol),
            symbol,
            risk_config: RwLock::new(config),
            user_configs: DashMap::new(),
            default_user_config: RwLock::new(UserRiskConfig::default()),
            open_orders: OpenOrderTracker::new(),
            circuit_breaker: Arc::new(CircuitBreaker::default()),
            event_sequence: AtomicU64::new(0),
        }
    }

    /// Set user-specific risk configuration
    pub fn set_user_risk_config(&self, user_id: &str, config: UserRiskConfig) {
        self.user_configs.insert(user_id.to_string(), config);
    }

    /// Update default user risk config
    pub fn set_default_user_risk_config(&self, config: UserRiskConfig) {
        *self.default_user_config.write() = config;
    }

    /// Get user risk config (per-user if set, otherwise default)
    fn get_user_config(&self, user_id: &str) -> UserRiskConfig {
        self.user_configs
            .get(user_id)
            .map(|c| c.clone())
            .unwrap_or_else(|| self.default_user_config.read().clone())
    }

    /// Get next event sequence number
    fn next_sequence(&self) -> u64 {
        self.event_sequence.fetch_add(1, AtomicOrdering::SeqCst)
    }

    /// Get the symbol
    pub fn symbol(&self) -> &Symbol {
        &self.symbol
    }

    /// Process a place order command
    pub fn place_order(&self, cmd: PlaceOrderCommand) -> Vec<EngineEvent> {
        let mut events = Vec::new();

        // Check circuit breaker — reject if market is halted
        if !self.circuit_breaker.is_trading_allowed(&self.symbol) {
            let order_seq = self.engine.orderbook().next_sequence();
            let order = cmd.to_order(order_seq);
            warn!(symbol = %self.symbol, "Order rejected: market halted by circuit breaker");
            events.push(EngineEvent::OrderRejected(OrderRejectedEvent::new(
                &order,
                "Market halted by circuit breaker".to_string(),
                self.next_sequence(),
            )));
            return events;
        }

        let order_seq = self.engine.orderbook().next_sequence();
        let order = cmd.to_order(order_seq);

        // Run risk checks
        let risk_config = self.risk_config.read();
        let user_config = self.get_user_config(&cmd.user_id.to_string());
        let checker = RiskChecker::new(risk_config.clone(), user_config);
        
        // Calculate mid price from best bid/ask
        let reference_price = match (self.engine.orderbook().best_bid(), self.engine.orderbook().best_ask()) {
            (Some((bid, _)), Some((ask, _))) => Some((bid + ask) / dotmx_core::to_decimal(2.0)),
            _ => None,
        };
        let open_orders = self.open_orders.count(&cmd.user_id.to_string());

        match checker.check_order(&order, reference_price, open_orders) {
            RiskCheckResult::Failed(rejection) => {
                warn!(
                    order_id = %order.id,
                    user_id = %cmd.user_id,
                    rejection = %rejection,
                    "Order rejected by risk check"
                );
                events.push(EngineEvent::OrderRejected(OrderRejectedEvent::new(
                    &order,
                    rejection.to_string(),
                    self.next_sequence(),
                )));
                return events;
            }
            RiskCheckResult::Passed => {}
        }

        // Process order through matching engine (returns MatchResult directly, not Result)
        let result = self.engine.process_order(order.clone());
        events.extend(self.generate_events(&order, &result));

        // Feed trade prices into circuit breaker
        for trade in &result.trades {
            let state = self.circuit_breaker.check_price(self.symbol, trade.price);
            if state == MarketState::Halted {
                warn!(symbol = %self.symbol, trade_price = %trade.price, "Circuit breaker triggered by trade price");
            }
        }
        
        // Track open orders if not fully filled (added to book)
        if !result.fully_filled {
            self.open_orders.increment(&cmd.user_id.to_string());
        }

        events
    }

    /// Process a cancel order command
    pub fn cancel_order(&self, cmd: CancelOrderCommand) -> Vec<EngineEvent> {
        let mut events = Vec::new();

        // Try cancelling from the orderbook first
        match self.engine.orderbook().cancel_order(cmd.order_id) {
            Ok(order) => {
                self.open_orders.decrement(&cmd.user_id.to_string());
                events.push(EngineEvent::OrderCancelled(OrderCancelledEvent::from_order(
                    &order,
                    CancelReason::UserRequested,
                    self.next_sequence(),
                )));
                info!(order_id = %cmd.order_id, "Order cancelled from book");
            }
            Err(_) => {
                // Try cancelling from pending stop orders
                if let Some(order) = self.engine.cancel_stop_order(cmd.order_id) {
                    events.push(EngineEvent::OrderCancelled(OrderCancelledEvent::from_order(
                        &order,
                        CancelReason::UserRequested,
                        self.next_sequence(),
                    )));
                    info!(order_id = %cmd.order_id, "Stop order cancelled");
                } else {
                    // Order not found — create a synthetic rejected order for the event
                    let placeholder = Order::new_limit(
                        cmd.user_id.clone(),
                        cmd.symbol.clone(),
                        dotmx_core::Side::Buy,
                        0, 0,
                        dotmx_core::TimeInForce::GTC, 0,
                    );
                    events.push(EngineEvent::OrderRejected(OrderRejectedEvent::new(
                        &placeholder,
                        format!("Order {} not found for cancel", cmd.order_id),
                        self.next_sequence(),
                    )));
                    warn!(order_id = %cmd.order_id, "Cancel failed: order not found");
                }
            }
        }

        events
    }

    /// Process a modify order command (atomic cancel-replace)
    pub fn modify_order(&self, cmd: dotmx_core::ModifyOrderCommand) -> Vec<EngineEvent> {
        let mut events = Vec::new();

        // Step 1: Cancel the existing order from the book
        let old_order = match self.engine.orderbook().cancel_order(cmd.order_id) {
            Ok(order) => {
                self.open_orders.decrement(&cmd.user_id.to_string());
                order
            }
            Err(_) => {
                // Also try stop orders
                match self.engine.cancel_stop_order(cmd.order_id) {
                    Some(order) => order,
                    None => {
                        let placeholder = Order::new_limit(
                            cmd.user_id.clone(),
                            cmd.symbol.clone(),
                            dotmx_core::Side::Buy,
                            0, 0,
                            dotmx_core::TimeInForce::GTC, 0,
                        );
                        events.push(EngineEvent::OrderRejected(OrderRejectedEvent::new(
                            &placeholder,
                            format!("Order {} not found for modify", cmd.order_id),
                            self.next_sequence(),
                        )));
                        warn!(order_id = %cmd.order_id, "Modify failed: order not found");
                        return events;
                    }
                }
            }
        };

        // Emit cancel event for the old order
        events.push(EngineEvent::OrderCancelled(OrderCancelledEvent::from_order(
            &old_order,
            CancelReason::UserRequested,
            self.next_sequence(),
        )));

        // Step 2: Create replacement order with new price/quantity
        let new_price = cmd.new_price.unwrap_or(old_order.price);
        let new_quantity = cmd.new_quantity.unwrap_or(old_order.quantity);
        let order_seq = self.engine.orderbook().next_sequence();
        let replacement = PlaceOrderCommand {
            request_id: cmd.request_id.clone(),
            user_id: old_order.user_id,
            symbol: old_order.symbol,
            side: old_order.side,
            order_type: old_order.order_type,
            price: new_price,
            quantity: new_quantity,
            time_in_force: old_order.time_in_force,
            stop_price: old_order.stop_price,
        };
        let new_order = replacement.to_order(order_seq);

        // Step 3: Process the replacement through the engine
        let result = self.engine.process_order(new_order.clone());
        events.extend(self.generate_events(&new_order, &result));

        if !result.fully_filled {
            self.open_orders.increment(&cmd.user_id.to_string());
        }

        info!(
            old_order_id = %cmd.order_id,
            new_order_id = %new_order.id,
            "Order modified (cancel-replace)"
        );

        events
    }

    /// Generate events from a match result
    fn generate_events(&self, order: &Order, result: &MatchResult) -> Vec<EngineEvent> {
        let mut events = Vec::new();

        // Order accepted (if not fully filled or trades executed)
        if !result.fully_filled || !result.trades.is_empty() {
            events.push(EngineEvent::OrderAccepted(OrderAcceptedEvent::from_order(
                order,
                self.next_sequence(),
            )));
        }

        // Trade events
        for trade in &result.trades {
            events.push(EngineEvent::TradeExecuted(TradeExecutedEvent::from_trade(
                trade,
                self.next_sequence(),
            )));

            // Maker fill event
            events.push(EngineEvent::OrderFilled(OrderFilledEvent {
                sequence: self.next_sequence(),
                timestamp: dotmx_core::now_nanos(),
                order_id: trade.maker_order_id,
                user_id: trade.maker_user_id.clone(),
                symbol: trade.symbol.clone(),
                side: trade.maker_side,
                price: trade.price,
                filled_quantity: trade.quantity,
                remaining_quantity: 0, // Would need to track this
                is_maker: true,
                trade_id: trade.id,
            }));

            // Taker fill event
            events.push(EngineEvent::OrderFilled(OrderFilledEvent {
                sequence: self.next_sequence(),
                timestamp: dotmx_core::now_nanos(),
                order_id: trade.taker_order_id,
                user_id: trade.taker_user_id.clone(),
                symbol: trade.symbol.clone(),
                side: trade.taker_side,
                price: trade.price,
                filled_quantity: trade.quantity,
                remaining_quantity: result.order.remaining(),
                is_maker: false,
                trade_id: trade.id,
            }));
        }

        // Cancelled if IOC/FOK not fully filled
        if result.order.status == dotmx_core::OrderStatus::Cancelled {
            let reason = match result.order.time_in_force {
                dotmx_core::TimeInForce::IOC => CancelReason::ImmediateOrCancel,
                dotmx_core::TimeInForce::FOK => CancelReason::FillOrKill,
                dotmx_core::TimeInForce::PostOnly => CancelReason::PostOnlyRejected,
                _ => CancelReason::SystemCancelled,
            };
            events.push(EngineEvent::OrderCancelled(OrderCancelledEvent::from_order(
                &result.order,
                reason,
                self.next_sequence(),
            )));
        }

        events
    }

    /// Get orderbook snapshot with price-level aggregation
    pub fn snapshot(&self, depth: usize) -> dotmx_core::OrderbookSnapshot {
        let inner = self.engine.orderbook().inner_read();
        let mut bids = Vec::with_capacity(depth);
        let mut asks = Vec::with_capacity(depth);

        // Aggregate bid levels (highest price first)
        for (key, level) in inner.bids.iter() {
            if bids.len() >= depth {
                break;
            }
            bids.push(dotmx_core::PriceLevel {
                price: key.0,
                quantity: level.total_quantity,
                order_count: level.orders.len() as u32,
            });
        }

        // Aggregate ask levels (lowest price first)
        for (&price, level) in inner.asks.iter() {
            if asks.len() >= depth {
                break;
            }
            asks.push(dotmx_core::PriceLevel {
                price,
                quantity: level.total_quantity,
                order_count: level.orders.len() as u32,
            });
        }

        dotmx_core::OrderbookSnapshot {
            symbol: self.symbol.clone(),
            bids,
            asks,
            sequence: self.next_sequence(),
            timestamp: dotmx_core::now_nanos(),
        }
    }

    /// Get current best bid/ask
    pub fn bbo(&self) -> (Option<dotmx_core::Decimal>, Option<dotmx_core::Decimal>) {
        let bid = self.engine.orderbook().best_bid().map(|(p, _)| p);
        let ask = self.engine.orderbook().best_ask().map(|(p, _)| p);
        (bid, ask)
    }

    /// Get order count
    pub fn order_count(&self) -> usize {
        self.engine.orderbook().order_count()
    }

    /// Update risk configuration
    pub fn update_risk_config(&self, config: MarketRiskConfig) {
        *self.risk_config.write() = config;
    }

    /// Update circuit breaker configuration (requires mutable reference)
    /// Note: For runtime config changes, prefer creating a new shard or use halt/resume methods.
    // pub fn update_circuit_breaker_config(&mut self, config: CircuitBreakerConfig) { ... }

    /// Manually halt market via circuit breaker
    pub fn halt_market(&self) {
        self.circuit_breaker.set_market_state(self.symbol, MarketState::Halted);
        warn!(symbol = %self.symbol, "Market manually halted");
    }

    /// Resume market after halt
    pub fn resume_market(&self) {
        self.circuit_breaker.set_market_state(self.symbol, MarketState::Open);
        info!(symbol = %self.symbol, "Market resumed");
    }

    /// Check if market is halted
    pub fn is_halted(&self) -> bool {
        !self.circuit_breaker.is_trading_allowed(&self.symbol)
    }

    /// Get market state
    pub fn market_state(&self) -> MarketState {
        self.circuit_breaker.market_state(&self.symbol)
    }
}

/// Shard manager handles multiple market shards
pub struct ShardManager {
    shards: DashMap<Symbol, Arc<MarketShard>>,
}

impl Default for ShardManager {
    fn default() -> Self {
        Self::new()
    }
}

impl ShardManager {
    pub fn new() -> Self {
        Self {
            shards: DashMap::new(),
        }
    }

    /// Add a shard for a symbol
    pub fn add_shard(&self, symbol: impl AsRef<str>) -> Arc<MarketShard> {
        let sym = Symbol::new(symbol.as_ref());
        let shard = Arc::new(MarketShard::new(symbol.as_ref()));
        self.shards.insert(sym, shard.clone());
        info!(symbol = %symbol.as_ref(), "Added market shard");
        shard
    }

    /// Add a shard with custom risk config
    pub fn add_shard_with_config(&self, config: MarketRiskConfig) -> Arc<MarketShard> {
        let sym = config.symbol;
        let shard = Arc::new(MarketShard::with_symbol(sym, config));
        self.shards.insert(sym, shard.clone());
        info!(symbol = %sym, "Added market shard with config");
        shard
    }

    /// Get a shard by symbol name
    pub fn get(&self, symbol: &str) -> Option<Arc<MarketShard>> {
        let sym = Symbol::new(symbol);
        self.shards.get(&sym).map(|s| s.clone())
    }

    /// Get a shard by Symbol directly
    pub fn get_by_symbol(&self, symbol: &Symbol) -> Option<Arc<MarketShard>> {
        self.shards.get(symbol).map(|s| s.clone())
    }

    /// Remove a shard
    pub fn remove(&self, symbol: &str) -> Option<Arc<MarketShard>> {
        let sym = Symbol::new(symbol);
        self.shards.remove(&sym).map(|(_, s)| s)
    }

    /// Get all symbols
    pub fn symbols(&self) -> Vec<String> {
        self.shards.iter().map(|e| format!("{}", e.key())).collect()
    }

    /// Get total order count across all shards
    pub fn total_orders(&self) -> usize {
        self.shards.iter().map(|s| s.order_count()).sum()
    }

    /// Process a command and route to appropriate shard
    pub fn process_command(&self, cmd: EngineCommand) -> Vec<EngineEvent> {
        match cmd {
            EngineCommand::PlaceOrder(place_cmd) => {
                if let Some(shard) = self.get_by_symbol(&place_cmd.symbol) {
                    shard.place_order(place_cmd)
                } else {
                    warn!(symbol = %place_cmd.symbol, "No shard for symbol");
                    vec![]
                }
            }
            EngineCommand::CancelOrder(cancel_cmd) => {
                if let Some(shard) = self.get_by_symbol(&cancel_cmd.symbol) {
                    shard.cancel_order(cancel_cmd)
                } else {
                    warn!(symbol = %cancel_cmd.symbol, "No shard for symbol");
                    vec![]
                }
            }
            EngineCommand::ModifyOrder(modify_cmd) => {
                if let Some(shard) = self.get_by_symbol(&modify_cmd.symbol) {
                    shard.modify_order(modify_cmd)
                } else {
                    warn!(symbol = %modify_cmd.symbol, "No shard for symbol");
                    vec![]
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use dotmx_core::{Side, OrderType, TimeInForce, UserId, to_decimal};

    fn create_place_cmd(side: Side, price: f64, qty: f64) -> PlaceOrderCommand {
        PlaceOrderCommand {
            request_id: "test-req".to_string(),
            user_id: UserId::new("user1"),
            symbol: Symbol::new("BTC-USDT"),
            side,
            order_type: OrderType::Limit,
            price: to_decimal(price),
            quantity: to_decimal(qty),
            time_in_force: TimeInForce::GTC,
            stop_price: 0,
        }
    }

    #[test]
    fn test_market_shard_place_order() {
        let shard = MarketShard::new("BTC-USDT");
        
        let cmd = create_place_cmd(Side::Buy, 50000.0, 1.0);
        let events = shard.place_order(cmd);

        // Should have OrderAccepted event
        assert!(!events.is_empty());
        assert!(matches!(events[0], EngineEvent::OrderAccepted(_)));
        assert_eq!(shard.order_count(), 1);
    }

    #[test]
    fn test_market_shard_match() {
        let shard = MarketShard::new("BTC-USDT");
        
        // Place sell order
        let sell_cmd = PlaceOrderCommand {
            request_id: "sell-1".to_string(),
            user_id: UserId::new("user1"),
            symbol: Symbol::new("BTC-USDT"),
            side: Side::Sell,
            order_type: OrderType::Limit,
            price: to_decimal(50000.0),
            quantity: to_decimal(1.0),
            time_in_force: TimeInForce::GTC,
            stop_price: 0,
        };
        shard.place_order(sell_cmd);

        // Place matching buy order
        let buy_cmd = PlaceOrderCommand {
            request_id: "buy-1".to_string(),
            user_id: UserId::new("user2"),
            symbol: Symbol::new("BTC-USDT"),
            side: Side::Buy,
            order_type: OrderType::Limit,
            price: to_decimal(50000.0),
            quantity: to_decimal(1.0),
            time_in_force: TimeInForce::GTC,
            stop_price: 0,
        };
        let events = shard.place_order(buy_cmd);

        // Should have trade events
        let trade_events: Vec<_> = events.iter()
            .filter(|e| matches!(e, EngineEvent::TradeExecuted(_)))
            .collect();
        assert_eq!(trade_events.len(), 1);

        // Book should be empty
        assert_eq!(shard.order_count(), 0);
    }

    #[test]
    fn test_shard_manager() {
        let manager = ShardManager::new();
        
        manager.add_shard("BTC-USDT");
        manager.add_shard("ETH-USDT");

        assert!(manager.get("BTC-USDT").is_some());
        assert!(manager.get("ETH-USDT").is_some());
        assert!(manager.get("DOGE-USDT").is_none());

        let symbols = manager.symbols();
        assert_eq!(symbols.len(), 2);
    }

    #[test]
    fn test_shard_manager_process_command() {
        let manager = ShardManager::new();
        manager.add_shard("BTC-USDT");

        let cmd = EngineCommand::PlaceOrder(create_place_cmd(Side::Buy, 50000.0, 1.0));
        let events = manager.process_command(cmd);

        assert!(!events.is_empty());
    }
}
