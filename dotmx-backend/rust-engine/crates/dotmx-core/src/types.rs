//! Core types for the DotMX matching engine
//!
//! All monetary values use fixed-point arithmetic with 8 decimal places
//! to avoid floating-point precision issues.
//!
//! PERFORMANCE: This engine uses fast sequential IDs by default instead of UUIDs.
//! For cryptographic IDs, use OrderId::new_random().

use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

/// Global atomic counter for fast ID generation
static ORDER_ID_COUNTER: AtomicU64 = AtomicU64::new(1);
static TRADE_ID_COUNTER: AtomicU64 = AtomicU64::new(1);

/// Timestamp in nanoseconds since epoch (much faster than chrono)
pub type Timestamp = u64;

/// Get current timestamp in nanoseconds (fast)
#[inline]
pub fn now_nanos() -> Timestamp {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos() as u64
}

/// Fixed-point decimal with 8 decimal places (satoshi precision)
/// Value stored as integer: 1.00000000 = 100_000_000
pub type Decimal = i64;

/// Decimal multiplier for 8 decimal places
pub const DECIMAL_PLACES: i64 = 100_000_000;

/// Convert f64 to fixed-point decimal
#[inline]
pub fn to_decimal(value: f64) -> Decimal {
    (value * DECIMAL_PLACES as f64).round() as Decimal
}

/// Convert fixed-point decimal to f64
#[inline]
pub fn from_decimal(value: Decimal) -> f64 {
    value as f64 / DECIMAL_PLACES as f64
}

/// Multiply two decimals (result needs division by DECIMAL_PLACES)
#[inline]
pub fn mul_decimal(a: Decimal, b: Decimal) -> Decimal {
    ((a as i128 * b as i128) / DECIMAL_PLACES as i128) as Decimal
}

/// Divide two decimals
#[inline]
pub fn div_decimal(a: Decimal, b: Decimal) -> Decimal {
    ((a as i128 * DECIMAL_PLACES as i128) / b as i128) as Decimal
}

/// Order side: Buy or Sell
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Side {
    Buy,
    Sell,
}

impl Side {
    /// Get the opposite side
    #[inline]
    pub fn opposite(&self) -> Self {
        match self {
            Side::Buy => Side::Sell,
            Side::Sell => Side::Buy,
        }
    }
}

/// Order type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OrderType {
    Limit,
    Market,
    StopLimit,
    StopMarket,
}

/// Time in force for orders
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum TimeInForce {
    /// Good till cancelled
    GTC,
    /// Immediate or cancel
    IOC,
    /// Fill or kill
    FOK,
    /// Post only (maker only)
    PostOnly,
}

/// Order status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OrderStatus {
    New,
    PartiallyFilled,
    Filled,
    Cancelled,
    Rejected,
    Expired,
}

/// Unique order identifier (64-bit for speed)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct OrderId(pub u64);

impl OrderId {
    /// Create a new order ID using fast atomic counter (DEFAULT - FAST)
    #[inline]
    pub fn new() -> Self {
        Self(ORDER_ID_COUNTER.fetch_add(1, AtomicOrdering::Relaxed))
    }

    /// Create from u64 value directly
    #[inline]
    pub fn from_u64(val: u64) -> Self {
        Self(val)
    }

    /// Parse from string
    pub fn from_string(s: &str) -> Result<Self, std::num::ParseIntError> {
        Ok(Self(s.parse()?))
    }

    /// Get the raw u64 value
    #[inline]
    pub fn as_u64(&self) -> u64 {
        self.0
    }
}

impl Default for OrderId {
    #[inline]
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for OrderId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Unique trade identifier (64-bit for speed)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct TradeId(pub u64);

impl TradeId {
    /// Create a new trade ID using fast atomic counter (DEFAULT - FAST)
    #[inline]
    pub fn new() -> Self {
        Self(TRADE_ID_COUNTER.fetch_add(1, AtomicOrdering::Relaxed))
    }

    /// Create from u64 value directly
    #[inline]
    pub fn from_u64(val: u64) -> Self {
        Self(val)
    }

    /// Get the raw u64 value
    #[inline]
    pub fn as_u64(&self) -> u64 {
        self.0
    }
}

impl Default for TradeId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for TradeId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// User/Account identifier - FAST: uses u64 internally (no allocation)
/// For string representation, use UserId::from_str() which hashes to u64
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct UserId(pub u64);

impl UserId {
    /// Create from numeric ID (instant, no allocation)
    #[inline]
    pub const fn from_u64(id: u64) -> Self {
        Self(id)
    }
    
    /// Create from string by hashing (for compatibility - still fast, ~10ns)
    #[inline]
    pub fn new(id: impl AsRef<str>) -> Self {
        Self(fast_hash(id.as_ref().as_bytes()))
    }
}

impl std::fmt::Display for UserId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Market/Symbol identifier - FAST: uses u64 internally (no allocation)
/// Common symbols can be pre-computed as constants
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Symbol(pub u64);

impl Symbol {
    /// Create from numeric ID (instant)
    #[inline]
    pub const fn from_u64(id: u64) -> Self {
        Self(id)
    }
    
    /// Create from string by hashing (for compatibility - still fast)
    #[inline]
    pub fn new(s: impl AsRef<str>) -> Self {
        Self(fast_hash(s.as_ref().as_bytes()))
    }
}

impl std::fmt::Display for Symbol {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Fast non-cryptographic hash (FNV-1a) - deterministic, ~5ns for short strings
#[inline]
const fn fast_hash(bytes: &[u8]) -> u64 {
    const FNV_OFFSET: u64 = 0xcbf29ce484222325;
    const FNV_PRIME: u64 = 0x100000001b3;
    
    let mut hash = FNV_OFFSET;
    let mut i = 0;
    while i < bytes.len() {
        hash ^= bytes[i] as u64;
        hash = hash.wrapping_mul(FNV_PRIME);
        i += 1;
    }
    hash
}

/// A limit order in the orderbook (optimized for speed)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Order {
    pub id: OrderId,
    pub user_id: UserId,
    pub symbol: Symbol,
    pub side: Side,
    pub order_type: OrderType,
    pub price: Decimal,
    pub quantity: Decimal,
    pub filled_quantity: Decimal,
    pub time_in_force: TimeInForce,
    pub status: OrderStatus,
    /// Timestamp in nanoseconds since epoch (fast)
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
    /// Sequence number for FIFO ordering at same price
    pub sequence: u64,
    /// Stop/trigger price for StopLimit and StopMarket orders
    #[serde(default)]
    pub stop_price: Decimal,
}

impl Order {
    /// Create a new limit order (FAST - uses atomic counter ID)
    #[inline]
    pub fn new_limit(
        user_id: UserId,
        symbol: Symbol,
        side: Side,
        price: Decimal,
        quantity: Decimal,
        time_in_force: TimeInForce,
        sequence: u64,
    ) -> Self {
        let now = now_nanos();
        Self {
            id: OrderId::new(),
            user_id,
            symbol,
            side,
            order_type: OrderType::Limit,
            price,
            quantity,
            filled_quantity: 0,
            time_in_force,
            status: OrderStatus::New,
            created_at: now,
            updated_at: now,
            sequence,
            stop_price: 0,
        }
    }

    /// Create a new market order (FAST)
    #[inline]
    pub fn new_market(
        user_id: UserId,
        symbol: Symbol,
        side: Side,
        quantity: Decimal,
        sequence: u64,
    ) -> Self {
        let now = now_nanos();
        Self {
            id: OrderId::new(),
            user_id,
            symbol,
            side,
            order_type: OrderType::Market,
            price: 0,
            quantity,
            filled_quantity: 0,
            time_in_force: TimeInForce::IOC,
            status: OrderStatus::New,
            created_at: now,
            updated_at: now,
            sequence,
            stop_price: 0,
        }
    }

    /// Create a new stop-limit order
    #[inline]
    pub fn new_stop_limit(
        user_id: UserId,
        symbol: Symbol,
        side: Side,
        price: Decimal,
        stop_price: Decimal,
        quantity: Decimal,
        time_in_force: TimeInForce,
        sequence: u64,
    ) -> Self {
        let now = now_nanos();
        Self {
            id: OrderId::new(),
            user_id,
            symbol,
            side,
            order_type: OrderType::StopLimit,
            price,
            quantity,
            filled_quantity: 0,
            time_in_force,
            status: OrderStatus::New,
            created_at: now,
            updated_at: now,
            sequence,
            stop_price,
        }
    }

    /// Create a new stop-market order
    #[inline]
    pub fn new_stop_market(
        user_id: UserId,
        symbol: Symbol,
        side: Side,
        stop_price: Decimal,
        quantity: Decimal,
        sequence: u64,
    ) -> Self {
        let now = now_nanos();
        Self {
            id: OrderId::new(),
            user_id,
            symbol,
            side,
            order_type: OrderType::StopMarket,
            price: 0,
            quantity,
            filled_quantity: 0,
            time_in_force: TimeInForce::IOC,
            status: OrderStatus::New,
            created_at: now,
            updated_at: now,
            sequence,
            stop_price,
        }
    }

    /// Get remaining quantity
    #[inline]
    pub fn remaining(&self) -> Decimal {
        self.quantity - self.filled_quantity
    }

    /// Check if order is fully filled
    #[inline]
    pub fn is_filled(&self) -> bool {
        self.filled_quantity >= self.quantity
    }

    /// Fill the order with given quantity (FAST)
    #[inline]
    pub fn fill(&mut self, qty: Decimal) {
        self.filled_quantity += qty;
        self.updated_at = now_nanos();
        
        if self.is_filled() {
            self.status = OrderStatus::Filled;
        } else if self.filled_quantity > 0 {
            self.status = OrderStatus::PartiallyFilled;
        }
    }

    /// Cancel the order (FAST)
    #[inline]
    pub fn cancel(&mut self) {
        self.status = OrderStatus::Cancelled;
        self.updated_at = now_nanos();
    }
}

/// A trade execution between two orders
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trade {
    pub id: TradeId,
    pub symbol: Symbol,
    pub price: Decimal,
    pub quantity: Decimal,
    pub maker_order_id: OrderId,
    pub taker_order_id: OrderId,
    pub maker_user_id: UserId,
    pub taker_user_id: UserId,
    pub maker_side: Side,
    pub taker_side: Side,
    pub timestamp: Timestamp,
    pub sequence: u64,
}

impl Trade {
    /// Create a new trade (FAST - uses atomic counter ID)
    #[inline]
    pub fn new(
        symbol: Symbol,
        price: Decimal,
        quantity: Decimal,
        maker_order_id: OrderId,
        taker_order_id: OrderId,
        maker_user_id: UserId,
        taker_user_id: UserId,
        maker_side: Side,
        taker_side: Side,
        sequence: u64,
    ) -> Self {
        Self {
            id: TradeId::new(),
            symbol,
            price,
            quantity,
            maker_order_id,
            taker_order_id,
            maker_user_id,
            taker_user_id,
            maker_side,
            taker_side,
            timestamp: now_nanos(),
            sequence,
        }
    }

    /// Calculate notional value of the trade
    #[inline]
    pub fn notional(&self) -> Decimal {
        mul_decimal(self.price, self.quantity)
    }
}

/// Price level with aggregated quantity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriceLevel {
    pub price: Decimal,
    pub quantity: Decimal,
    pub order_count: u32,
}

/// Orderbook snapshot for market data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderbookSnapshot {
    pub symbol: Symbol,
    pub bids: Vec<PriceLevel>,
    pub asks: Vec<PriceLevel>,
    pub timestamp: Timestamp,
    pub sequence: u64,
}

/// Key for ordering orders in BTreeMap
/// Buy orders: higher price first, then lower sequence (earlier first)
/// Sell orders: lower price first, then lower sequence (earlier first)
#[derive(Debug, Clone, Copy, Eq, PartialEq)]
pub struct OrderKey {
    pub price: Decimal,
    pub sequence: u64,
    pub side: Side,
}

impl Ord for OrderKey {
    fn cmp(&self, other: &Self) -> Ordering {
        match self.side {
            Side::Buy => {
                // Buy side: higher price better, then lower sequence
                match other.price.cmp(&self.price) {
                    Ordering::Equal => self.sequence.cmp(&other.sequence),
                    ord => ord,
                }
            }
            Side::Sell => {
                // Sell side: lower price better, then lower sequence
                match self.price.cmp(&other.price) {
                    Ordering::Equal => self.sequence.cmp(&other.sequence),
                    ord => ord,
                }
            }
        }
    }
}

impl PartialOrd for OrderKey {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_decimal_conversion() {
        assert_eq!(to_decimal(1.0), DECIMAL_PLACES);
        assert_eq!(to_decimal(0.5), DECIMAL_PLACES / 2);
        assert_eq!(from_decimal(DECIMAL_PLACES), 1.0);
        assert_eq!(from_decimal(DECIMAL_PLACES / 2), 0.5);
    }

    #[test]
    fn test_decimal_multiplication() {
        let a = to_decimal(100.0);
        let b = to_decimal(0.5);
        let result = mul_decimal(a, b);
        assert_eq!(from_decimal(result), 50.0);
    }

    #[test]
    fn test_order_key_buy_ordering() {
        let k1 = OrderKey { price: to_decimal(100.0), sequence: 1, side: Side::Buy };
        let k2 = OrderKey { price: to_decimal(101.0), sequence: 2, side: Side::Buy };
        let k3 = OrderKey { price: to_decimal(100.0), sequence: 2, side: Side::Buy };

        // Higher price should come first for buys
        assert!(k2 < k1);
        // Same price, lower sequence comes first
        assert!(k1 < k3);
    }

    #[test]
    fn test_order_key_sell_ordering() {
        let k1 = OrderKey { price: to_decimal(100.0), sequence: 1, side: Side::Sell };
        let k2 = OrderKey { price: to_decimal(99.0), sequence: 2, side: Side::Sell };
        let k3 = OrderKey { price: to_decimal(100.0), sequence: 2, side: Side::Sell };

        // Lower price should come first for sells
        assert!(k2 < k1);
        // Same price, lower sequence comes first
        assert!(k1 < k3);
    }

    #[test]
    fn test_order_fill() {
        let mut order = Order::new_limit(
            UserId::new("user1"),
            Symbol::new("BTC-USDT"),
            Side::Buy,
            to_decimal(50000.0),
            to_decimal(1.0),
            TimeInForce::GTC,
            1,
        );

        assert_eq!(order.remaining(), to_decimal(1.0));
        
        order.fill(to_decimal(0.5));
        assert_eq!(order.status, OrderStatus::PartiallyFilled);
        assert_eq!(order.remaining(), to_decimal(0.5));

        order.fill(to_decimal(0.5));
        assert_eq!(order.status, OrderStatus::Filled);
        assert!(order.is_filled());
    }

    #[test]
    fn test_side_opposite() {
        assert_eq!(Side::Buy.opposite(), Side::Sell);
        assert_eq!(Side::Sell.opposite(), Side::Buy);
    }
}
