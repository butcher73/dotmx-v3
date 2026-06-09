//! Command and event handlers

use dotmx_core::EngineEvent;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::debug;

use crate::{NatsTransport, TransportError, subjects};

/// Response to a command
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "lowercase")]
pub enum CommandResponse {
    Success {
        request_id: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        order_id: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        message: Option<String>,
    },
    Error {
        request_id: String,
        code: String,
        message: String,
    },
}

impl CommandResponse {
    pub fn success(request_id: impl Into<String>) -> Self {
        CommandResponse::Success {
            request_id: request_id.into(),
            order_id: None,
            message: None,
        }
    }

    pub fn success_with_order(request_id: impl Into<String>, order_id: impl Into<String>) -> Self {
        CommandResponse::Success {
            request_id: request_id.into(),
            order_id: Some(order_id.into()),
            message: None,
        }
    }

    pub fn error(request_id: impl Into<String>, code: impl Into<String>, message: impl Into<String>) -> Self {
        CommandResponse::Error {
            request_id: request_id.into(),
            code: code.into(),
            message: message.into(),
        }
    }
}

/// Event publisher
pub struct EventPublisher {
    transport: Arc<NatsTransport>,
}

impl EventPublisher {
    pub fn new(transport: Arc<NatsTransport>) -> Self {
        Self { transport }
    }

    /// Publish an engine event
    pub async fn publish(&self, event: &EngineEvent) -> Result<(), TransportError> {
        let symbol = event.symbol();
        let symbol_str = symbol.to_string();

        match event {
            EngineEvent::OrderAccepted(e) => {
                self.transport
                    .publish(&subjects::events::order_event(&symbol_str, "accepted"), e)
                    .await?;
                // Also publish to user-specific subject
                self.transport
                    .publish(&subjects::user::orders(&e.user_id.to_string()), event)
                    .await?;
            }
            EngineEvent::OrderRejected(e) => {
                self.transport
                    .publish(&subjects::events::order_event(&symbol_str, "rejected"), e)
                    .await?;
                self.transport
                    .publish(&subjects::user::orders(&e.user_id.to_string()), event)
                    .await?;
            }
            EngineEvent::OrderFilled(e) => {
                self.transport
                    .publish(&subjects::events::order_event(&symbol_str, "filled"), e)
                    .await?;
                self.transport
                    .publish(&subjects::user::orders(&e.user_id.to_string()), event)
                    .await?;
            }
            EngineEvent::OrderCancelled(e) => {
                self.transport
                    .publish(&subjects::events::order_event(&symbol_str, "cancelled"), e)
                    .await?;
                self.transport
                    .publish(&subjects::user::orders(&e.user_id.to_string()), event)
                    .await?;
            }
            EngineEvent::TradeExecuted(e) => {
                self.transport
                    .publish(&subjects::events::trade(&symbol_str), e)
                    .await?;
                // Notify both maker and taker
                self.transport
                    .publish(&subjects::user::trades(&e.maker_user_id.to_string()), event)
                    .await?;
                self.transport
                    .publish(&subjects::user::trades(&e.taker_user_id.to_string()), event)
                    .await?;
            }
            EngineEvent::OrderbookUpdate(e) => {
                self.transport
                    .publish(&subjects::events::orderbook(&symbol_str), e)
                    .await?;
            }
            EngineEvent::OrderExpired(e) => {
                self.transport
                    .publish(&subjects::events::order_event(&symbol_str, "expired"), e)
                    .await?;
                self.transport
                    .publish(&subjects::user::orders(&e.user_id.to_string()), event)
                    .await?;
            }
        }

        debug!(event_type = ?std::mem::discriminant(event), "Published event");
        Ok(())
    }

    /// Publish market data
    pub async fn publish_l2(&self, symbol: &str, snapshot: &dotmx_core::OrderbookSnapshot) -> Result<(), TransportError> {
        self.transport
            .publish(&subjects::marketdata::l2(symbol), snapshot)
            .await
    }

    /// Publish trade to market data stream
    pub async fn publish_trade(&self, symbol: &str, trade: &dotmx_core::Trade) -> Result<(), TransportError> {
        self.transport
            .publish(&subjects::marketdata::trades(symbol), trade)
            .await
    }
}

/// Batch event publisher for high throughput
pub struct BatchEventPublisher {
    transport: Arc<NatsTransport>,
    batch_size: usize,
    events: tokio::sync::Mutex<Vec<(String, Vec<u8>)>>,
}

impl BatchEventPublisher {
    pub fn new(transport: Arc<NatsTransport>, batch_size: usize) -> Self {
        Self {
            transport,
            batch_size,
            events: tokio::sync::Mutex::new(Vec::with_capacity(batch_size)),
        }
    }

    /// Queue an event for batch publishing
    pub async fn queue<T: Serialize>(&self, subject: &str, payload: &T) -> Result<(), TransportError> {
        let data = serde_json::to_vec(payload)?;
        let mut events = self.events.lock().await;
        events.push((subject.to_string(), data));

        if events.len() >= self.batch_size {
            self.flush_internal(&mut events).await?;
        }

        Ok(())
    }

    /// Flush all queued events
    pub async fn flush(&self) -> Result<(), TransportError> {
        let mut events = self.events.lock().await;
        self.flush_internal(&mut events).await
    }

    async fn flush_internal(&self, events: &mut Vec<(String, Vec<u8>)>) -> Result<(), TransportError> {
        if events.is_empty() {
            return Ok(());
        }

        for (subject, data) in events.drain(..) {
            self.transport.client().publish(subject, data.into()).await
                .map_err(|e| TransportError::PublishError(e.to_string()))?;
        }

        self.transport.flush().await?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_command_response_serialization() {
        let success = CommandResponse::success_with_order("req-123", "order-456");
        let json = serde_json::to_string(&success).unwrap();
        assert!(json.contains("\"status\":\"success\""));
        assert!(json.contains("\"order_id\":\"order-456\""));

        let error = CommandResponse::error("req-123", "INVALID_ORDER", "Order size too small");
        let json = serde_json::to_string(&error).unwrap();
        assert!(json.contains("\"status\":\"error\""));
        assert!(json.contains("INVALID_ORDER"));
    }
}
