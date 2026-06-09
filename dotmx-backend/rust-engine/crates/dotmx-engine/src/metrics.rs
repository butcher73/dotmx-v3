//! Engine metrics

use metrics::{counter, gauge, histogram};
use std::time::Instant;

/// Metric names
pub mod names {
    pub const ORDERS_RECEIVED: &str = "engine_orders_received_total";
    pub const ORDERS_MATCHED: &str = "engine_orders_matched_total";
    pub const ORDERS_REJECTED: &str = "engine_orders_rejected_total";
    pub const ORDERS_CANCELLED: &str = "engine_orders_cancelled_total";
    pub const TRADES_EXECUTED: &str = "engine_trades_executed_total";
    pub const TRADE_VOLUME: &str = "engine_trade_volume_total";
    pub const ORDER_LATENCY: &str = "engine_order_latency_seconds";
    pub const ORDERBOOK_DEPTH: &str = "engine_orderbook_depth";
    pub const OPEN_ORDERS: &str = "engine_open_orders";
    pub const EVENTS_PUBLISHED: &str = "engine_events_published_total";
    pub const NATS_MESSAGES_RECEIVED: &str = "engine_nats_messages_received_total";
    pub const NATS_MESSAGES_PUBLISHED: &str = "engine_nats_messages_published_total";
}

/// Record an order received
pub fn record_order_received(symbol: &str, side: &str) {
    counter!(names::ORDERS_RECEIVED, "symbol" => symbol.to_string(), "side" => side.to_string()).increment(1);
}

/// Record a successful match
pub fn record_order_matched(symbol: &str) {
    counter!(names::ORDERS_MATCHED, "symbol" => symbol.to_string()).increment(1);
}

/// Record an order rejection
pub fn record_order_rejected(symbol: &str, reason: &str) {
    counter!(names::ORDERS_REJECTED, "symbol" => symbol.to_string(), "reason" => reason.to_string()).increment(1);
}

/// Record an order cancellation
pub fn record_order_cancelled(symbol: &str) {
    counter!(names::ORDERS_CANCELLED, "symbol" => symbol.to_string()).increment(1);
}

/// Record a trade execution
pub fn record_trade(symbol: &str, quantity: f64, price: f64) {
    counter!(names::TRADES_EXECUTED, "symbol" => symbol.to_string()).increment(1);
    counter!(names::TRADE_VOLUME, "symbol" => symbol.to_string()).increment((quantity * price) as u64);
}

/// Record order processing latency
pub fn record_latency(symbol: &str, start: Instant) {
    let duration = start.elapsed().as_secs_f64();
    histogram!(names::ORDER_LATENCY, "symbol" => symbol.to_string()).record(duration);
}

/// Update orderbook depth gauge
pub fn set_orderbook_depth(symbol: &str, side: &str, depth: usize) {
    gauge!(names::ORDERBOOK_DEPTH, "symbol" => symbol.to_string(), "side" => side.to_string()).set(depth as f64);
}

/// Update open orders gauge
pub fn set_open_orders(symbol: &str, count: usize) {
    gauge!(names::OPEN_ORDERS, "symbol" => symbol.to_string()).set(count as f64);
}

/// Record events published
pub fn record_event_published(event_type: &str) {
    counter!(names::EVENTS_PUBLISHED, "type" => event_type.to_string()).increment(1);
}

/// Record NATS message received
pub fn record_nats_received(subject: &str) {
    counter!(names::NATS_MESSAGES_RECEIVED, "subject" => subject.to_string()).increment(1);
}

/// Record NATS message published
pub fn record_nats_published(subject: &str) {
    counter!(names::NATS_MESSAGES_PUBLISHED, "subject" => subject.to_string()).increment(1);
}

/// Timer guard for measuring operation latency
pub struct LatencyTimer {
    symbol: String,
    start: Instant,
}

impl LatencyTimer {
    pub fn new(symbol: impl Into<String>) -> Self {
        Self {
            symbol: symbol.into(),
            start: Instant::now(),
        }
    }
}

impl Drop for LatencyTimer {
    fn drop(&mut self) {
        record_latency(&self.symbol, self.start);
    }
}

/// Setup Prometheus metrics exporter
pub fn setup_metrics(bind: &str, port: u16) -> anyhow::Result<()> {
    use metrics_exporter_prometheus::PrometheusBuilder;
    use std::net::SocketAddr;

    let addr: SocketAddr = format!("{}:{}", bind, port).parse()?;
    
    PrometheusBuilder::new()
        .with_http_listener(addr)
        .install()?;

    tracing::info!(address = %addr, "Prometheus metrics server started");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_latency_timer() {
        let _timer = LatencyTimer::new("BTC-USDT");
        std::thread::sleep(std::time::Duration::from_millis(1));
        // Timer will record on drop
    }
}
