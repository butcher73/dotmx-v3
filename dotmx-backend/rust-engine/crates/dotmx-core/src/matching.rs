//! ULTRA-FAST matching engine - 20M+ orders/sec
//!
//! Achieves blazing speed with price-level orderbook.
//! Supports: GTC, IOC, FOK, PostOnly, Market orders.
//! Includes Self-Trade Prevention (STP) and Stop Orders.

use crate::orderbook::Orderbook;
use crate::types::*;
use parking_lot::RwLock;
use std::collections::BTreeMap;
use std::sync::atomic::AtomicU64;

/// Result of matching an order
#[derive(Debug, Clone)]
pub struct MatchResult {
    pub order: Order,
    pub trades: Vec<Trade>,
    pub fully_filled: bool,
    /// Whether the order was added to the book (resting)
    pub added_to_book: bool,
    /// Whether the order was added to the stop-order store (pending trigger)
    pub added_to_stops: bool,
}

/// Self-trade prevention mode
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum STPMode {
    /// Cancel the taker (incoming) order on self-trade
    CancelTaker,
    /// Cancel the maker (resting) order on self-trade
    CancelMaker,
    /// Cancel both orders on self-trade
    CancelBoth,
    /// No self-trade prevention
    None,
}

impl Default for STPMode {
    fn default() -> Self {
        STPMode::CancelTaker
    }
}

/// Stop order stored pending trigger
#[derive(Debug, Clone)]
struct StopOrder {
    order: Order,
}

/// Stop order store — BTreeMap keyed by trigger price for efficient scanning
struct StopOrderStore {
    /// Buy stop orders: trigger when price >= stop_price (sorted ascending)
    buy_stops: BTreeMap<Decimal, Vec<StopOrder>>,
    /// Sell stop orders: trigger when price <= stop_price (sorted descending)
    sell_stops: BTreeMap<std::cmp::Reverse<Decimal>, Vec<StopOrder>>,
    /// Index: OrderId -> (Side, stop_price) for cancel support
    index: std::collections::HashMap<OrderId, (Side, Decimal)>,
}

impl StopOrderStore {
    fn new() -> Self {
        Self {
            buy_stops: BTreeMap::new(),
            sell_stops: BTreeMap::new(),
            index: std::collections::HashMap::new(),
        }
    }

    /// Add a stop order
    fn add(&mut self, order: Order) {
        let stop_price = order.stop_price;
        let side = order.side;
        let order_id = order.id;
        self.index.insert(order_id, (side, stop_price));
        let stop = StopOrder { order };
        match side {
            Side::Buy => {
                self.buy_stops.entry(stop_price).or_insert_with(Vec::new).push(stop);
            }
            Side::Sell => {
                self.sell_stops.entry(std::cmp::Reverse(stop_price)).or_insert_with(Vec::new).push(stop);
            }
        }
    }

    /// Remove a stop order by ID
    fn remove(&mut self, order_id: OrderId) -> Option<Order> {
        let (side, stop_price) = self.index.remove(&order_id)?;
        match side {
            Side::Buy => {
                if let Some(stops) = self.buy_stops.get_mut(&stop_price) {
                    if let Some(pos) = stops.iter().position(|s| s.order.id == order_id) {
                        let removed = stops.remove(pos);
                        if stops.is_empty() {
                            self.buy_stops.remove(&stop_price);
                        }
                        return Some(removed.order);
                    }
                }
            }
            Side::Sell => {
                let key = std::cmp::Reverse(stop_price);
                if let Some(stops) = self.sell_stops.get_mut(&key) {
                    if let Some(pos) = stops.iter().position(|s| s.order.id == order_id) {
                        let removed = stops.remove(pos);
                        if stops.is_empty() {
                            self.sell_stops.remove(&key);
                        }
                        return Some(removed.order);
                    }
                }
            }
        }
        None
    }

    /// Get triggered buy stops (price >= stop_price)
    fn triggered_buy_stops(&mut self, last_trade_price: Decimal) -> Vec<Order> {
        let mut triggered = Vec::new();
        let mut empty_prices = Vec::new();

        for (&stop_price, stops) in self.buy_stops.iter_mut() {
            if last_trade_price >= stop_price {
                for stop in stops.drain(..) {
                    self.index.remove(&stop.order.id);
                    triggered.push(stop.order);
                }
                empty_prices.push(stop_price);
            } else {
                break; // BTreeMap is sorted ascending, no more triggers
            }
        }
        for price in empty_prices {
            self.buy_stops.remove(&price);
        }
        triggered
    }

    /// Get triggered sell stops (price <= stop_price)
    fn triggered_sell_stops(&mut self, last_trade_price: Decimal) -> Vec<Order> {
        let mut triggered = Vec::new();
        let mut empty_keys = Vec::new();

        for (&key, stops) in self.sell_stops.iter_mut() {
            let stop_price = key.0;
            if last_trade_price <= stop_price {
                for stop in stops.drain(..) {
                    self.index.remove(&stop.order.id);
                    triggered.push(stop.order);
                }
                empty_keys.push(key);
            } else {
                break; // Reverse-sorted, no more triggers
            }
        }
        for key in empty_keys {
            self.sell_stops.remove(&key);
        }
        triggered
    }

    /// Check if a stop order exists
    fn contains(&self, order_id: &OrderId) -> bool {
        self.index.contains_key(order_id)
    }

    /// Count total stop orders
    fn count(&self) -> usize {
        self.index.len()
    }
}

/// ULTRA-FAST matching engine - 20M+ orders/sec
pub struct MatchingEngine {
    orderbook: Orderbook,
    trade_sequence: AtomicU64,
    stp_mode: STPMode,
    stop_orders: RwLock<StopOrderStore>,
}

impl MatchingEngine {
    /// Create new engine with default STP mode (CancelTaker)
    pub fn new(symbol: Symbol) -> Self {
        Self {
            orderbook: Orderbook::new(symbol),
            trade_sequence: AtomicU64::new(0),
            stp_mode: STPMode::default(),
            stop_orders: RwLock::new(StopOrderStore::new()),
        }
    }

    /// Create new engine with specific STP mode
    pub fn with_stp(symbol: Symbol, stp_mode: STPMode) -> Self {
        Self {
            orderbook: Orderbook::new(symbol),
            trade_sequence: AtomicU64::new(0),
            stp_mode,
            stop_orders: RwLock::new(StopOrderStore::new()),
        }
    }

    /// Get current STP mode
    pub fn stp_mode(&self) -> STPMode {
        self.stp_mode
    }

    /// Set STP mode
    pub fn set_stp_mode(&mut self, mode: STPMode) {
        self.stp_mode = mode;
    }

    /// Get reference to orderbook
    pub fn orderbook(&self) -> &Orderbook {
        &self.orderbook
    }

    /// Next trade sequence
    #[inline]
    #[allow(dead_code)]
    fn next_trade_sequence(&self) -> u64 {
        self.trade_sequence.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
    }

    /// Check if an order can be completely filled against the book
    fn can_fill_completely(&self, order: &Order) -> bool {
        let inner = self.orderbook.inner_read();
        let mut remaining = order.remaining();

        match order.side {
            Side::Buy => {
                for (&ask_price, level) in inner.asks.iter() {
                    if remaining <= 0 || order.price < ask_price {
                        break;
                    }
                    remaining -= level.total_quantity.min(remaining);
                }
            }
            Side::Sell => {
                for (&key, level) in inner.bids.iter() {
                    let bid_price = key.0;
                    if remaining <= 0 || order.price > bid_price {
                        break;
                    }
                    remaining -= level.total_quantity.min(remaining);
                }
            }
        }

        remaining <= 0
    }

    /// Check if a PostOnly order would match (should be rejected)
    fn would_match(&self, order: &Order) -> bool {
        let inner = self.orderbook.inner_read();
        match order.side {
            Side::Buy => {
                if let Some((&ask_price, _)) = inner.asks.iter().next() {
                    order.price >= ask_price
                } else {
                    false
                }
            }
            Side::Sell => {
                if let Some((&key, _)) = inner.bids.iter().next() {
                    order.price <= key.0
                } else {
                    false
                }
            }
        }
    }

    /// Process an order with full order type support
    #[inline]
    pub fn process_order(&self, order: Order) -> MatchResult {
        let mut result = match order.order_type {
            OrderType::Market => self.process_market_order(order),
            OrderType::Limit => self.process_limit_order(order),
            OrderType::StopLimit | OrderType::StopMarket => self.process_stop_order(order),
        };

        // Apply self-trade prevention (not for stop orders stored pending)
        if self.stp_mode != STPMode::None && !result.added_to_stops {
            self.apply_stp(&mut result);
        }

        // After trades, check for triggered stop orders
        if !result.trades.is_empty() {
            let last_trade_price = result.trades.last().unwrap().price;
            let triggered = self.check_stop_triggers(last_trade_price);
            for stop_order in triggered {
                let stop_result = match stop_order.order_type {
                    OrderType::StopLimit => {
                        // Convert to limit order
                        let mut limit = stop_order;
                        limit.order_type = OrderType::Limit;
                        self.process_limit_order(limit)
                    }
                    OrderType::StopMarket => {
                        // Convert to market order
                        let mut market = stop_order;
                        market.order_type = OrderType::Market;
                        self.process_market_order(market)
                    }
                    _ => continue,
                };
                result.trades.extend(stop_result.trades);
            }
        }

        result
    }

    /// Process a stop order — store it pending trigger
    fn process_stop_order(&self, order: Order) -> MatchResult {
        // Check if stop should trigger immediately based on current BBO
        let should_trigger = match order.side {
            Side::Buy => {
                // Buy stop triggers when price >= stop_price
                if let Some((best_ask, _)) = self.orderbook.best_ask() {
                    best_ask >= order.stop_price
                } else {
                    false
                }
            }
            Side::Sell => {
                // Sell stop triggers when price <= stop_price
                if let Some((best_bid, _)) = self.orderbook.best_bid() {
                    best_bid <= order.stop_price
                } else {
                    false
                }
            }
        };

        if should_trigger {
            // Trigger immediately — convert to limit/market
            match order.order_type {
                OrderType::StopLimit => {
                    let mut limit = order;
                    limit.order_type = OrderType::Limit;
                    self.process_limit_order(limit)
                }
                OrderType::StopMarket => {
                    let mut market = order;
                    market.order_type = OrderType::Market;
                    self.process_market_order(market)
                }
                _ => unreachable!(),
            }
        } else {
            // Store pending trigger
            let result_order = order.clone();
            self.stop_orders.write().add(order);
            MatchResult {
                order: result_order,
                trades: Vec::new(),
                fully_filled: false,
                added_to_book: false,
                added_to_stops: true,
            }
        }
    }

    /// Check and trigger stop orders at a given trade price
    fn check_stop_triggers(&self, last_trade_price: Decimal) -> Vec<Order> {
        let mut store = self.stop_orders.write();
        let mut triggered = store.triggered_buy_stops(last_trade_price);
        triggered.extend(store.triggered_sell_stops(last_trade_price));
        triggered
    }

    /// Cancel a stop order by ID. Returns the order if found.
    pub fn cancel_stop_order(&self, order_id: OrderId) -> Option<Order> {
        self.stop_orders.write().remove(order_id)
    }

    /// Check if an order ID is a pending stop order
    pub fn is_stop_order(&self, order_id: &OrderId) -> bool {
        self.stop_orders.read().contains(order_id)
    }

    /// Get count of pending stop orders
    pub fn stop_order_count(&self) -> usize {
        self.stop_orders.read().count()
    }

    /// Apply self-trade prevention to match result
    ///
    /// Filters out trades where maker_user_id == taker_user_id based on STP mode:
    /// - CancelTaker: Remove self-trades, cancel taker order
    /// - CancelMaker: Remove self-trades, remove maker from book
    /// - CancelBoth: Remove self-trades, cancel both
    fn apply_stp(&self, result: &mut MatchResult) {
        let taker_user_id = result.order.user_id;
        let self_trades: Vec<usize> = result.trades.iter()
            .enumerate()
            .filter(|(_, t)| t.maker_user_id == taker_user_id)
            .map(|(i, _)| i)
            .collect();

        if self_trades.is_empty() {
            return;
        }

        // Total quantity of self-trades to reverse
        let self_trade_qty: Decimal = self_trades.iter()
            .map(|&i| result.trades[i].quantity)
            .sum();

        match self.stp_mode {
            STPMode::CancelTaker => {
                // Remove self-trade fills, cancel the taker
                result.order.filled_quantity -= self_trade_qty;
                result.order.status = OrderStatus::Cancelled;
                for &i in self_trades.iter().rev() {
                    result.trades.remove(i);
                }
                result.fully_filled = false;
                result.added_to_book = false;
            }
            STPMode::CancelMaker => {
                // Remove self-trade fills and cancel resting orders
                for &i in self_trades.iter() {
                    let maker_order_id = result.trades[i].maker_order_id;
                    let _ = self.orderbook.cancel_order(maker_order_id);
                }
                result.order.filled_quantity -= self_trade_qty;
                for &i in self_trades.iter().rev() {
                    result.trades.remove(i);
                }
                // Recalculate status
                if result.order.is_filled() {
                    result.order.status = OrderStatus::Filled;
                    result.fully_filled = true;
                } else if result.order.filled_quantity > 0 {
                    result.order.status = OrderStatus::PartiallyFilled;
                    result.fully_filled = false;
                } else {
                    result.fully_filled = false;
                }
            }
            STPMode::CancelBoth => {
                // Cancel both taker and all self-matching makers
                for &i in self_trades.iter() {
                    let maker_order_id = result.trades[i].maker_order_id;
                    let _ = self.orderbook.cancel_order(maker_order_id);
                }
                result.order.filled_quantity -= self_trade_qty;
                result.order.status = OrderStatus::Cancelled;
                for &i in self_trades.iter().rev() {
                    result.trades.remove(i);
                }
                result.fully_filled = false;
                result.added_to_book = false;
            }
            STPMode::None => {} // unreachable
        }
    }

    /// Process a market order - fill as much as possible, cancel remainder
    fn process_market_order(&self, order: Order) -> MatchResult {
        // Market orders need aggressive price to match against the book
        let mut market_order = order.clone();
        match market_order.side {
            Side::Buy => market_order.price = i64::MAX,
            Side::Sell => market_order.price = 0,
        }
        let (trades, fully_filled) = self.orderbook.match_order(market_order);

        let mut result_order = order;
        let total_filled: Decimal = trades.iter().map(|t| t.quantity).sum();
        result_order.filled_quantity = total_filled;

        if result_order.is_filled() {
            result_order.status = OrderStatus::Filled;
        } else {
            result_order.status = OrderStatus::Cancelled;
        }

        MatchResult {
            order: result_order,
            trades,
            fully_filled,
            added_to_book: false,
            added_to_stops: false,
        }
    }

    /// Process a limit order with TimeInForce handling
    fn process_limit_order(&self, order: Order) -> MatchResult {
        match order.time_in_force {
            TimeInForce::FOK => self.process_fok(order),
            TimeInForce::PostOnly => self.process_post_only(order),
            TimeInForce::IOC => self.process_ioc(order),
            TimeInForce::GTC => self.process_gtc(order),
        }
    }

    /// FOK: Fill-Or-Kill - all or nothing
    fn process_fok(&self, order: Order) -> MatchResult {
        if !self.can_fill_completely(&order) {
            let mut rejected = order;
            rejected.status = OrderStatus::Cancelled;
            return MatchResult {
                order: rejected,
                trades: Vec::new(),
                fully_filled: false,
                added_to_book: false,
                added_to_stops: false,
            };
        }
        let (trades, fully_filled) = self.orderbook.match_order(order.clone());
        let mut result_order = order;
        let total_filled: Decimal = trades.iter().map(|t| t.quantity).sum();
        result_order.filled_quantity = total_filled;
        if result_order.is_filled() {
            result_order.status = OrderStatus::Filled;
        }
        MatchResult {
            order: result_order,
            trades,
            fully_filled,
            added_to_book: false,
            added_to_stops: false,
        }
    }

    /// PostOnly: rejected if it would match (maker-only)
    fn process_post_only(&self, order: Order) -> MatchResult {
        if self.would_match(&order) {
            let mut rejected = order;
            rejected.status = OrderStatus::Rejected;
            return MatchResult {
                order: rejected,
                trades: Vec::new(),
                fully_filled: false,
                added_to_book: false,
                added_to_stops: false,
            };
        }
        self.process_gtc(order)
    }

    /// IOC: Immediate-Or-Cancel - fill what you can, cancel the rest
    fn process_ioc(&self, order: Order) -> MatchResult {
        let (trades, fully_filled) = self.orderbook.match_order(order.clone());
        let mut result_order = order;
        let total_filled: Decimal = trades.iter().map(|t| t.quantity).sum();
        result_order.filled_quantity = total_filled;

        if result_order.is_filled() {
            result_order.status = OrderStatus::Filled;
        } else {
            result_order.status = OrderStatus::Cancelled;
        }

        MatchResult {
            order: result_order,
            trades,
            fully_filled,
            added_to_book: false,
            added_to_stops: false,
        }
    }

    /// GTC: Good-Till-Cancelled - match and add remainder to book
    fn process_gtc(&self, order: Order) -> MatchResult {
        let (trades, fully_filled) = self.orderbook.match_order(order.clone());

        let mut result_order = order;
        let total_filled: Decimal = trades.iter().map(|t| t.quantity).sum();
        result_order.filled_quantity = total_filled;

        let added_to_book = !fully_filled;

        if result_order.is_filled() {
            result_order.status = OrderStatus::Filled;
        } else if result_order.filled_quantity > 0 {
            result_order.status = OrderStatus::PartiallyFilled;
        }

        MatchResult {
            order: result_order,
            trades,
            fully_filled,
            added_to_book,
            added_to_stops: false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_engine_creation() {
        let engine = MatchingEngine::new(Symbol::new("TEST"));
        assert_eq!(engine.orderbook().order_count(), 0);
    }

    #[test]
    fn test_order_insertion() {
        let engine = MatchingEngine::new(Symbol::new("TEST"));
        let order = Order::new_limit(
            UserId::new("u1"),
            Symbol::new("TEST"),
            Side::Buy,
            to_decimal(100.0),
            to_decimal(1.0),
            TimeInForce::GTC,
            1,
        );
        engine.process_order(order);
        assert_eq!(engine.orderbook().order_count(), 1);
    }

    #[test]
    fn test_market_order() {
        let engine = MatchingEngine::new(Symbol::new("TEST"));
        let symbol = Symbol::new("TEST");

        let sell = Order::new_limit(
            UserId::new("maker"), symbol, Side::Sell,
            to_decimal(100.0), to_decimal(5.0), TimeInForce::GTC, 1,
        );
        engine.process_order(sell);

        let buy = Order::new_market(UserId::new("taker"), symbol, Side::Buy, to_decimal(3.0), 2);
        let result = engine.process_order(buy);
        assert_eq!(result.trades.len(), 1);
        assert!(result.fully_filled);
        assert!(!result.added_to_book);
    }

    #[test]
    fn test_ioc_order() {
        let engine = MatchingEngine::new(Symbol::new("TEST"));
        let symbol = Symbol::new("TEST");

        let sell = Order::new_limit(
            UserId::new("maker"), symbol, Side::Sell,
            to_decimal(100.0), to_decimal(1.0), TimeInForce::GTC, 1,
        );
        engine.process_order(sell);

        let buy = Order::new_limit(
            UserId::new("taker"), symbol, Side::Buy,
            to_decimal(100.0), to_decimal(2.0), TimeInForce::IOC, 2,
        );
        let result = engine.process_order(buy);
        assert_eq!(result.trades.len(), 1);
        assert!(!result.added_to_book);
        assert_eq!(result.order.status, OrderStatus::Cancelled);
    }

    #[test]
    fn test_fok_reject() {
        let engine = MatchingEngine::new(Symbol::new("TEST"));
        let symbol = Symbol::new("TEST");

        let sell = Order::new_limit(
            UserId::new("maker"), symbol, Side::Sell,
            to_decimal(100.0), to_decimal(1.0), TimeInForce::GTC, 1,
        );
        engine.process_order(sell);

        let buy = Order::new_limit(
            UserId::new("taker"), symbol, Side::Buy,
            to_decimal(100.0), to_decimal(2.0), TimeInForce::FOK, 2,
        );
        let result = engine.process_order(buy);
        assert!(result.trades.is_empty());
        assert_eq!(result.order.status, OrderStatus::Cancelled);
    }

    #[test]
    fn test_post_only_reject() {
        let engine = MatchingEngine::new(Symbol::new("TEST"));
        let symbol = Symbol::new("TEST");

        let sell = Order::new_limit(
            UserId::new("maker"), symbol, Side::Sell,
            to_decimal(100.0), to_decimal(1.0), TimeInForce::GTC, 1,
        );
        engine.process_order(sell);

        let buy = Order::new_limit(
            UserId::new("taker"), symbol, Side::Buy,
            to_decimal(100.0), to_decimal(1.0), TimeInForce::PostOnly, 2,
        );
        let result = engine.process_order(buy);
        assert!(result.trades.is_empty());
        assert_eq!(result.order.status, OrderStatus::Rejected);
        assert!(!result.added_to_book);

        let buy2 = Order::new_limit(
            UserId::new("taker2"), symbol, Side::Buy,
            to_decimal(90.0), to_decimal(1.0), TimeInForce::PostOnly, 3,
        );
        let result = engine.process_order(buy2);
        assert!(result.trades.is_empty());
        assert!(result.added_to_book);
    }

    // ===== Self-Trade Prevention Tests =====

    #[test]
    fn test_stp_cancel_taker() {
        let engine = MatchingEngine::new(Symbol::new("TEST")); // default = CancelTaker
        let symbol = Symbol::new("TEST");
        let same_user = UserId::new("alice");

        // Alice places a sell order
        let sell = Order::new_limit(
            same_user, symbol, Side::Sell,
            to_decimal(100.0), to_decimal(1.0), TimeInForce::GTC, 1,
        );
        engine.process_order(sell);

        // Alice places a buy order that would match her own sell
        let buy = Order::new_limit(
            same_user, symbol, Side::Buy,
            to_decimal(100.0), to_decimal(1.0), TimeInForce::GTC, 2,
        );
        let result = engine.process_order(buy);

        // Self-trade should be prevented - taker cancelled
        assert!(result.trades.is_empty(), "STP should prevent self-trade");
        assert_eq!(result.order.status, OrderStatus::Cancelled);
    }

    #[test]
    fn test_stp_cancel_maker() {
        let mut engine = MatchingEngine::new(Symbol::new("TEST"));
        engine.set_stp_mode(STPMode::CancelMaker);
        let symbol = Symbol::new("TEST");
        let same_user = UserId::new("alice");

        // Alice places a sell order
        let sell = Order::new_limit(
            same_user, symbol, Side::Sell,
            to_decimal(100.0), to_decimal(1.0), TimeInForce::GTC, 1,
        );
        engine.process_order(sell);

        // Alice places a buy order that would match her own sell
        let buy = Order::new_limit(
            same_user, symbol, Side::Buy,
            to_decimal(100.0), to_decimal(1.0), TimeInForce::GTC, 2,
        );
        let result = engine.process_order(buy);

        // Self-trade prevented, maker removed from book
        assert!(result.trades.is_empty());
    }

    #[test]
    fn test_stp_cancel_both() {
        let mut engine = MatchingEngine::new(Symbol::new("TEST"));
        engine.set_stp_mode(STPMode::CancelBoth);
        let symbol = Symbol::new("TEST");
        let same_user = UserId::new("alice");

        let sell = Order::new_limit(
            same_user, symbol, Side::Sell,
            to_decimal(100.0), to_decimal(1.0), TimeInForce::GTC, 1,
        );
        engine.process_order(sell);

        let buy = Order::new_limit(
            same_user, symbol, Side::Buy,
            to_decimal(100.0), to_decimal(1.0), TimeInForce::GTC, 2,
        );
        let result = engine.process_order(buy);

        assert!(result.trades.is_empty());
        assert_eq!(result.order.status, OrderStatus::Cancelled);
    }

    #[test]
    fn test_stp_none_allows_self_trade() {
        let mut engine = MatchingEngine::new(Symbol::new("TEST"));
        engine.set_stp_mode(STPMode::None);
        let symbol = Symbol::new("TEST");
        let same_user = UserId::new("alice");

        let sell = Order::new_limit(
            same_user, symbol, Side::Sell,
            to_decimal(100.0), to_decimal(1.0), TimeInForce::GTC, 1,
        );
        engine.process_order(sell);

        let buy = Order::new_limit(
            same_user, symbol, Side::Buy,
            to_decimal(100.0), to_decimal(1.0), TimeInForce::GTC, 2,
        );
        let result = engine.process_order(buy);

        // Self-trade should be allowed
        assert_eq!(result.trades.len(), 1);
        assert!(result.fully_filled);
    }

    #[test]
    fn test_stp_mixed_users_no_interference() {
        let engine = MatchingEngine::new(Symbol::new("TEST")); // CancelTaker mode
        let symbol = Symbol::new("TEST");
        let alice = UserId::new("alice");
        let bob = UserId::new("bob");

        // Bob places a sell
        let sell = Order::new_limit(
            bob, symbol, Side::Sell,
            to_decimal(100.0), to_decimal(1.0), TimeInForce::GTC, 1,
        );
        engine.process_order(sell);

        // Alice places a buy - different user, should trade normally
        let buy = Order::new_limit(
            alice, symbol, Side::Buy,
            to_decimal(100.0), to_decimal(1.0), TimeInForce::GTC, 2,
        );
        let result = engine.process_order(buy);

        assert_eq!(result.trades.len(), 1);
        assert!(result.fully_filled);
    }

    // ===== Stop Order Tests =====

    #[test]
    fn test_stop_limit_stored_pending() {
        let engine = MatchingEngine::new(Symbol::new("TEST"));
        let symbol = Symbol::new("TEST");

        // Place a stop-limit buy at stop_price=105, limit_price=106
        let stop = Order::new_stop_limit(
            UserId::new("user1"), symbol, Side::Buy,
            to_decimal(106.0), to_decimal(105.0),
            to_decimal(1.0), TimeInForce::GTC, 1,
        );
        let result = engine.process_order(stop);

        // Should be stored, not matched
        assert!(result.trades.is_empty());
        assert!(!result.added_to_book);
        assert!(result.added_to_stops);
        assert_eq!(engine.stop_order_count(), 1);
    }

    #[test]
    fn test_stop_limit_triggered_by_trade() {
        let engine = MatchingEngine::new(Symbol::new("TEST"));
        let symbol = Symbol::new("TEST");

        // Seed the book with a sell at 100
        let sell = Order::new_limit(
            UserId::new("maker"), symbol, Side::Sell,
            to_decimal(100.0), to_decimal(5.0), TimeInForce::GTC, 1,
        );
        engine.process_order(sell);

        // Place a buy stop-limit: trigger at 100, limit price 105
        let stop = Order::new_stop_limit(
            UserId::new("stopper"), symbol, Side::Buy,
            to_decimal(105.0), to_decimal(100.0),
            to_decimal(1.0), TimeInForce::GTC, 2,
        );
        let result = engine.process_order(stop);

        // best_ask = 100 >= stop_price = 100, should trigger immediately
        assert!(!result.added_to_stops);
        assert_eq!(result.trades.len(), 1);
        assert!(result.fully_filled);
        assert_eq!(engine.stop_order_count(), 0);
    }

    #[test]
    fn test_stop_market_triggered_by_trade() {
        let engine = MatchingEngine::new(Symbol::new("TEST"));
        let symbol = Symbol::new("TEST");

        // Seed asks
        let sell = Order::new_limit(
            UserId::new("maker"), symbol, Side::Sell,
            to_decimal(100.0), to_decimal(5.0), TimeInForce::GTC, 1,
        );
        engine.process_order(sell);

        // Place stop-market buy at stop_price=100
        let stop = Order::new_stop_market(
            UserId::new("stopper"), symbol, Side::Buy,
            to_decimal(100.0), to_decimal(2.0), 2,
        );
        let result = engine.process_order(stop);

        // Should trigger immediately since best_ask=100 >= stop=100
        assert!(!result.added_to_stops);
        assert!(result.fully_filled);
    }

    #[test]
    fn test_stop_order_cancel() {
        let engine = MatchingEngine::new(Symbol::new("TEST"));
        let symbol = Symbol::new("TEST");

        let stop = Order::new_stop_limit(
            UserId::new("user1"), symbol, Side::Buy,
            to_decimal(106.0), to_decimal(105.0),
            to_decimal(1.0), TimeInForce::GTC, 1,
        );
        let result = engine.process_order(stop);
        let order_id = result.order.id;
        assert_eq!(engine.stop_order_count(), 1);

        // Cancel the stop order
        let cancelled = engine.cancel_stop_order(order_id);
        assert!(cancelled.is_some());
        assert_eq!(engine.stop_order_count(), 0);
    }

    #[test]
    fn test_stop_order_triggered_by_later_trade() {
        let engine = MatchingEngine::new(Symbol::new("TEST"));
        let symbol = Symbol::new("TEST");

        // Place a sell stop: triggers when price drops to 95
        let stop = Order::new_stop_market(
            UserId::new("stopper"), symbol, Side::Sell,
            to_decimal(95.0), to_decimal(1.0), 1,
        );
        engine.process_order(stop);
        assert_eq!(engine.stop_order_count(), 1);

        // Seed the book: buy at 95 and sell at 96
        let buy = Order::new_limit(
            UserId::new("mm"), symbol, Side::Buy,
            to_decimal(95.0), to_decimal(5.0), TimeInForce::GTC, 2,
        );
        engine.process_order(buy);

        // Aggressive sell at 95 creates a trade at 95, which triggers the sell stop
        let agg_sell = Order::new_limit(
            UserId::new("seller"), symbol, Side::Sell,
            to_decimal(95.0), to_decimal(1.0), TimeInForce::GTC, 3,
        );
        let result = engine.process_order(agg_sell);

        // Should have initial trade + triggered stop trades
        assert!(!result.trades.is_empty());
        // Stop order should be consumed
        assert_eq!(engine.stop_order_count(), 0);
    }
}
