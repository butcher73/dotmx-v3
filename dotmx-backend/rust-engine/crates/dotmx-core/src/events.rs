//! Event types for the matching engine
//!
//! Events are produced by the matching engine and can be persisted
//! for audit trail, replays, and market data distribution.

use crate::types::*;
use serde::{Deserialize, Serialize};

/// Sequence number for global event ordering
pub type EventSequence = u64;

/// All events produced by the matching engine
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum EngineEvent {
    /// New order accepted
    OrderAccepted(OrderAcceptedEvent),
    /// Order rejected (failed risk check, etc.)
    OrderRejected(OrderRejectedEvent),
    /// Order filled (partially or fully)
    OrderFilled(OrderFilledEvent),
    /// Order cancelled
    OrderCancelled(OrderCancelledEvent),
    /// Order expired
    OrderExpired(OrderExpiredEvent),
    /// Trade executed
    TradeExecuted(TradeExecutedEvent),
    /// Orderbook updated
    OrderbookUpdate(OrderbookUpdateEvent),
}

impl EngineEvent {
    /// Get the sequence number of this event
    pub fn sequence(&self) -> EventSequence {
        match self {
            EngineEvent::OrderAccepted(e) => e.sequence,
            EngineEvent::OrderRejected(e) => e.sequence,
            EngineEvent::OrderFilled(e) => e.sequence,
            EngineEvent::OrderCancelled(e) => e.sequence,
            EngineEvent::OrderExpired(e) => e.sequence,
            EngineEvent::TradeExecuted(e) => e.sequence,
            EngineEvent::OrderbookUpdate(e) => e.sequence,
        }
    }

    /// Get the timestamp of this event
    pub fn timestamp(&self) -> Timestamp {
        match self {
            EngineEvent::OrderAccepted(e) => e.timestamp,
            EngineEvent::OrderRejected(e) => e.timestamp,
            EngineEvent::OrderFilled(e) => e.timestamp,
            EngineEvent::OrderCancelled(e) => e.timestamp,
            EngineEvent::OrderExpired(e) => e.timestamp,
            EngineEvent::TradeExecuted(e) => e.timestamp,
            EngineEvent::OrderbookUpdate(e) => e.timestamp,
        }
    }

    /// Get the symbol this event relates to
    pub fn symbol(&self) -> &Symbol {
        match self {
            EngineEvent::OrderAccepted(e) => &e.symbol,
            EngineEvent::OrderRejected(e) => &e.symbol,
            EngineEvent::OrderFilled(e) => &e.symbol,
            EngineEvent::OrderCancelled(e) => &e.symbol,
            EngineEvent::OrderExpired(e) => &e.symbol,
            EngineEvent::TradeExecuted(e) => &e.symbol,
            EngineEvent::OrderbookUpdate(e) => &e.symbol,
        }
    }
}

/// Order accepted and added to orderbook
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderAcceptedEvent {
    pub sequence: EventSequence,
    pub timestamp: Timestamp,
    pub order_id: OrderId,
    pub user_id: UserId,
    pub symbol: Symbol,
    pub side: Side,
    pub order_type: OrderType,
    pub price: Decimal,
    pub quantity: Decimal,
    pub time_in_force: TimeInForce,
}

impl OrderAcceptedEvent {
    pub fn from_order(order: &Order, sequence: EventSequence) -> Self {
        Self {
            sequence,
            timestamp: now_nanos(),
            order_id: order.id,
            user_id: order.user_id.clone(),
            symbol: order.symbol.clone(),
            side: order.side,
            order_type: order.order_type,
            price: order.price,
            quantity: order.quantity,
            time_in_force: order.time_in_force,
        }
    }
}

/// Order rejected
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderRejectedEvent {
    pub sequence: EventSequence,
    pub timestamp: Timestamp,
    pub order_id: OrderId,
    pub user_id: UserId,
    pub symbol: Symbol,
    pub reason: String,
}

impl OrderRejectedEvent {
    pub fn new(order: &Order, reason: String, sequence: EventSequence) -> Self {
        Self {
            sequence,
            timestamp: now_nanos(),
            order_id: order.id,
            user_id: order.user_id.clone(),
            symbol: order.symbol.clone(),
            reason,
        }
    }
}

/// Order filled (partially or fully)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderFilledEvent {
    pub sequence: EventSequence,
    pub timestamp: Timestamp,
    pub order_id: OrderId,
    pub user_id: UserId,
    pub symbol: Symbol,
    pub side: Side,
    pub price: Decimal,
    pub filled_quantity: Decimal,
    pub remaining_quantity: Decimal,
    pub is_maker: bool,
    pub trade_id: TradeId,
}

impl OrderFilledEvent {
    pub fn from_trade(
        order: &Order,
        trade: &Trade,
        is_maker: bool,
        sequence: EventSequence,
    ) -> Self {
        Self {
            sequence,
            timestamp: now_nanos(),
            order_id: order.id,
            user_id: order.user_id.clone(),
            symbol: order.symbol.clone(),
            side: order.side,
            price: trade.price,
            filled_quantity: trade.quantity,
            remaining_quantity: order.remaining(),
            is_maker,
            trade_id: trade.id,
        }
    }
}

/// Order cancelled
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderCancelledEvent {
    pub sequence: EventSequence,
    pub timestamp: Timestamp,
    pub order_id: OrderId,
    pub user_id: UserId,
    pub symbol: Symbol,
    pub reason: CancelReason,
    pub remaining_quantity: Decimal,
}

/// Reason for order cancellation
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CancelReason {
    UserRequested,
    SelfTradePrevention,
    ImmediateOrCancel,
    FillOrKill,
    PostOnlyRejected,
    MarketOrderNoLiquidity,
    Expired,
    SystemCancelled,
}

impl OrderCancelledEvent {
    pub fn from_order(order: &Order, reason: CancelReason, sequence: EventSequence) -> Self {
        Self {
            sequence,
            timestamp: now_nanos(),
            order_id: order.id,
            user_id: order.user_id.clone(),
            symbol: order.symbol.clone(),
            reason,
            remaining_quantity: order.remaining(),
        }
    }
}

/// Order expired
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderExpiredEvent {
    pub sequence: EventSequence,
    pub timestamp: Timestamp,
    pub order_id: OrderId,
    pub user_id: UserId,
    pub symbol: Symbol,
}

/// Trade executed
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradeExecutedEvent {
    pub sequence: EventSequence,
    pub timestamp: Timestamp,
    pub trade_id: TradeId,
    pub symbol: Symbol,
    pub price: Decimal,
    pub quantity: Decimal,
    pub maker_order_id: OrderId,
    pub taker_order_id: OrderId,
    pub maker_user_id: UserId,
    pub taker_user_id: UserId,
    pub maker_side: Side,
    pub taker_side: Side,
}

impl TradeExecutedEvent {
    pub fn from_trade(trade: &Trade, sequence: EventSequence) -> Self {
        Self {
            sequence,
            timestamp: trade.timestamp,
            trade_id: trade.id,
            symbol: trade.symbol.clone(),
            price: trade.price,
            quantity: trade.quantity,
            maker_order_id: trade.maker_order_id,
            taker_order_id: trade.taker_order_id,
            maker_user_id: trade.maker_user_id.clone(),
            taker_user_id: trade.taker_user_id.clone(),
            maker_side: trade.maker_side,
            taker_side: trade.taker_side,
        }
    }
}

/// Orderbook update for market data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderbookUpdateEvent {
    pub sequence: EventSequence,
    pub timestamp: Timestamp,
    pub symbol: Symbol,
    pub best_bid: Option<(Decimal, Decimal)>,
    pub best_ask: Option<(Decimal, Decimal)>,
    pub bids: Vec<PriceLevel>,
    pub asks: Vec<PriceLevel>,
}

impl OrderbookUpdateEvent {
    pub fn from_snapshot(snapshot: &OrderbookSnapshot, sequence: EventSequence) -> Self {
        Self {
            sequence,
            timestamp: snapshot.timestamp,
            symbol: snapshot.symbol.clone(),
            best_bid: snapshot.bids.first().map(|l| (l.price, l.quantity)),
            best_ask: snapshot.asks.first().map(|l| (l.price, l.quantity)),
            bids: snapshot.bids.clone(),
            asks: snapshot.asks.clone(),
        }
    }
}

/// Command types that can be sent to the engine
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum EngineCommand {
    /// Place a new order
    PlaceOrder(PlaceOrderCommand),
    /// Cancel an existing order
    CancelOrder(CancelOrderCommand),
    /// Modify an existing order
    ModifyOrder(ModifyOrderCommand),
}

/// Command to place a new order
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaceOrderCommand {
    pub request_id: String,
    pub user_id: UserId,
    pub symbol: Symbol,
    pub side: Side,
    pub order_type: OrderType,
    pub price: Decimal,
    pub quantity: Decimal,
    pub time_in_force: TimeInForce,
    /// Stop/trigger price for StopLimit and StopMarket orders
    #[serde(default)]
    pub stop_price: Decimal,
}

impl PlaceOrderCommand {
    /// Create an Order from this command
    pub fn to_order(&self, sequence: u64) -> Order {
        match self.order_type {
            OrderType::Market => Order::new_market(
                self.user_id.clone(),
                self.symbol.clone(),
                self.side,
                self.quantity,
                sequence,
            ),
            OrderType::StopLimit => Order::new_stop_limit(
                self.user_id.clone(),
                self.symbol.clone(),
                self.side,
                self.price,
                self.stop_price,
                self.quantity,
                self.time_in_force,
                sequence,
            ),
            OrderType::StopMarket => Order::new_stop_market(
                self.user_id.clone(),
                self.symbol.clone(),
                self.side,
                self.stop_price,
                self.quantity,
                sequence,
            ),
            _ => Order::new_limit(
                self.user_id.clone(),
                self.symbol.clone(),
                self.side,
                self.price,
                self.quantity,
                self.time_in_force,
                sequence,
            ),
        }
    }
}

/// Command to cancel an order
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CancelOrderCommand {
    pub request_id: String,
    pub user_id: UserId,
    pub order_id: OrderId,
    pub symbol: Symbol,
}

/// Command to modify an order (cancel-replace)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModifyOrderCommand {
    pub request_id: String,
    pub user_id: UserId,
    pub order_id: OrderId,
    pub symbol: Symbol,
    pub new_price: Option<Decimal>,
    pub new_quantity: Option<Decimal>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_event_serialization() {
        let event = EngineEvent::TradeExecuted(TradeExecutedEvent {
            sequence: 1,
            timestamp: now_nanos(),
            trade_id: TradeId::new(),
            symbol: Symbol::new("BTC-USDT"),
            price: to_decimal(50000.0),
            quantity: to_decimal(1.0),
            maker_order_id: OrderId::new(),
            taker_order_id: OrderId::new(),
            maker_user_id: UserId::new("user1"),
            taker_user_id: UserId::new("user2"),
            maker_side: Side::Sell,
            taker_side: Side::Buy,
        });

        let json = serde_json::to_string(&event).unwrap();
        let parsed: EngineEvent = serde_json::from_str(&json).unwrap();

        assert_eq!(event.sequence(), parsed.sequence());
    }

    #[test]
    fn test_command_serialization() {
        let cmd = EngineCommand::PlaceOrder(PlaceOrderCommand {
            request_id: "req-123".to_string(),
            user_id: UserId::new("user1"),
            symbol: Symbol::new("BTC-USDT"),
            side: Side::Buy,
            order_type: OrderType::Limit,
            price: to_decimal(50000.0),
            quantity: to_decimal(1.0),
            time_in_force: TimeInForce::GTC,
            stop_price: 0,
        });

        let json = serde_json::to_string(&cmd).unwrap();
        assert!(json.contains("place_order"));
        
        let parsed: EngineCommand = serde_json::from_str(&json).unwrap();
        match parsed {
            EngineCommand::PlaceOrder(p) => {
                assert_eq!(p.request_id, "req-123");
            }
            _ => panic!("Wrong command type"),
        }
    }

    #[test]
    fn test_place_order_command_to_order() {
        let cmd = PlaceOrderCommand {
            request_id: "req-123".to_string(),
            user_id: UserId::new("user1"),
            symbol: Symbol::new("BTC-USDT"),
            side: Side::Buy,
            order_type: OrderType::Limit,
            price: to_decimal(50000.0),
            quantity: to_decimal(1.0),
            time_in_force: TimeInForce::GTC,
            stop_price: 0,
        };

        let order = cmd.to_order(1);
        assert_eq!(order.user_id, UserId::new("user1"));
        assert_eq!(order.price, to_decimal(50000.0));
        assert_eq!(order.quantity, to_decimal(1.0));
        assert_eq!(order.sequence, 1);
    }
}
