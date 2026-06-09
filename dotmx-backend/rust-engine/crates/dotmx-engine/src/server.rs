//! Engine server - main event loop and NATS integration

use crate::{EngineConfig, ShardManager, metrics};
use dotmx_core::{EngineCommand, EngineEvent};
use dotmx_transport::{
    NatsTransport, TransportConfig, EventPublisher, CommandResponse,
    subjects, parse_message, respond,
};
use futures::StreamExt;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::broadcast;
use tokio::time::interval;
use tracing::{debug, error, info, warn};

/// Engine server managing the full lifecycle
pub struct EngineServer {
    config: EngineConfig,
    shard_manager: Arc<ShardManager>,
    transport: Option<Arc<NatsTransport>>,
    shutdown_tx: broadcast::Sender<()>,
}

impl EngineServer {
    /// Create a new engine server
    pub fn new(config: EngineConfig) -> Self {
        let (shutdown_tx, _) = broadcast::channel(1);
        
        Self {
            config,
            shard_manager: Arc::new(ShardManager::new()),
            transport: None,
            shutdown_tx,
        }
    }

    /// Initialize the engine with all configured markets
    pub fn init_markets(&self) {
        for symbol in &self.config.symbols {
            if let Some(market_config) = self.config.markets.get(symbol) {
                self.shard_manager.add_shard_with_config(market_config.clone());
            } else {
                self.shard_manager.add_shard(symbol);
            }
        }
        info!(markets = ?self.config.symbols, "Initialized market shards");
    }

    /// Connect to NATS
    pub async fn connect(&mut self) -> anyhow::Result<()> {
        let transport_config = TransportConfig {
            urls: self.config.nats.urls.clone(),
            name: format!("dotmx-engine-{}", self.config.instance_id),
            jetstream: self.config.nats.jetstream,
            reconnect_buffer_size: self.config.nats.reconnect_buffer_size,
        };

        let transport = NatsTransport::connect(transport_config).await?;
        
        // Setup JetStream streams
        if self.config.nats.jetstream {
            transport.setup_streams().await?;
        }

        self.transport = Some(Arc::new(transport));
        info!("Connected to NATS");
        Ok(())
    }

    /// Start the engine server
    pub async fn run(&self) -> anyhow::Result<()> {
        let transport = self.transport.as_ref()
            .ok_or_else(|| anyhow::anyhow!("Not connected to NATS"))?;

        // Setup metrics
        if self.config.metrics.enabled {
            metrics::setup_metrics(&self.config.metrics.bind, self.config.metrics.port)?;
        }

        // Create event publisher
        let publisher = Arc::new(EventPublisher::new(transport.clone()));

        // Subscribe to commands for each symbol
        let mut handles = Vec::new();
        
        for symbol in &self.config.symbols {
            let subject = subjects::commands::all_for_symbol(symbol);
            let subscriber = transport.subscribe(&subject).await?;
            
            let shard_manager = self.shard_manager.clone();
            let publisher = publisher.clone();
            let transport = transport.clone();
            let shutdown_rx = self.shutdown_tx.subscribe();
            let symbol = symbol.clone();

            let handle = tokio::spawn(async move {
                Self::command_loop(
                    subscriber,
                    shard_manager,
                    publisher,
                    transport,
                    symbol,
                    shutdown_rx,
                ).await
            });
            
            handles.push(handle);
        }

        // Market data publishing task
        let shard_manager = self.shard_manager.clone();
        let transport = transport.clone();
        let interval_ms = self.config.marketdata_interval_ms;
        let l2_depth = self.config.l2_depth;
        let symbols = self.config.symbols.clone();
        let shutdown_rx = self.shutdown_tx.subscribe();

        let md_handle = tokio::spawn(async move {
            Self::marketdata_loop(
                shard_manager,
                transport,
                symbols,
                l2_depth,
                interval_ms,
                shutdown_rx,
            ).await
        });
        handles.push(md_handle);

        info!(
            instance = %self.config.instance_id,
            symbols = ?self.config.symbols,
            "Engine server running"
        );

        // Wait for shutdown signal
        let mut shutdown_rx = self.shutdown_tx.subscribe();
        let _ = shutdown_rx.recv().await;

        // Wait for all tasks to complete
        for handle in handles {
            let _ = handle.await;
        }

        info!("Engine server stopped");
        Ok(())
    }

    /// Command processing loop for a symbol
    async fn command_loop(
        mut subscriber: async_nats::Subscriber,
        shard_manager: Arc<ShardManager>,
        publisher: Arc<EventPublisher>,
        transport: Arc<NatsTransport>,
        symbol: String,
        mut shutdown_rx: broadcast::Receiver<()>,
    ) {
        info!(symbol = %symbol, "Starting command loop");

        loop {
            tokio::select! {
                Some(msg) = subscriber.next() => {
                    metrics::record_nats_received(&msg.subject);
                    
                    let _timer = metrics::LatencyTimer::new(&symbol);

                    // Parse command
                    let cmd: Result<EngineCommand, _> = parse_message(&msg);
                    
                    match cmd {
                        Ok(command) => {
                            debug!(symbol = %symbol, cmd = ?std::mem::discriminant(&command), "Received command");
                            
                            // Get request ID for response
                            let request_id = match &command {
                                EngineCommand::PlaceOrder(c) => c.request_id.clone(),
                                EngineCommand::CancelOrder(c) => c.request_id.clone(),
                                EngineCommand::ModifyOrder(c) => c.request_id.clone(),
                            };

                            // Process command
                            let events = shard_manager.process_command(command);

                            // Publish events
                            for event in &events {
                                if let Err(e) = publisher.publish(event).await {
                                    error!(error = %e, "Failed to publish event");
                                }
                            }

                            // Send response if request has reply subject
                            if msg.reply.is_some() {
                                let response = if events.iter().any(|e| matches!(e, EngineEvent::OrderRejected(_))) {
                                    // Find rejection reason
                                    let reason = events.iter()
                                        .find_map(|e| match e {
                                            EngineEvent::OrderRejected(r) => Some(r.reason.clone()),
                                            _ => None,
                                        })
                                        .unwrap_or_else(|| "Unknown".to_string());
                                    
                                    CommandResponse::error(&request_id, "REJECTED", reason)
                                } else {
                                    // Find order ID if accepted
                                    let order_id = events.iter()
                                        .find_map(|e| match e {
                                            EngineEvent::OrderAccepted(a) => Some(a.order_id.to_string()),
                                            _ => None,
                                        });

                                    match order_id {
                                        Some(id) => CommandResponse::success_with_order(&request_id, id),
                                        None => CommandResponse::success(&request_id),
                                    }
                                };

                                if let Err(e) = respond(transport.client(), &msg, &response).await {
                                    error!(error = %e, "Failed to send response");
                                }
                            }
                        }
                        Err(e) => {
                            warn!(error = %e, "Failed to parse command");
                            
                            if msg.reply.is_some() {
                                let response = CommandResponse::error("unknown", "PARSE_ERROR", e.to_string());
                                let _ = respond(transport.client(), &msg, &response).await;
                            }
                        }
                    }
                }
                _ = shutdown_rx.recv() => {
                    info!(symbol = %symbol, "Command loop shutting down");
                    break;
                }
            }
        }
    }

    /// Market data publishing loop
    async fn marketdata_loop(
        shard_manager: Arc<ShardManager>,
        transport: Arc<NatsTransport>,
        symbols: Vec<String>,
        depth: usize,
        interval_ms: u64,
        mut shutdown_rx: broadcast::Receiver<()>,
    ) {
        info!("Starting market data loop");
        let mut ticker = interval(Duration::from_millis(interval_ms));

        loop {
            tokio::select! {
                _ = ticker.tick() => {
                    for symbol in &symbols {
                        if let Some(shard) = shard_manager.get(symbol) {
                            let snapshot = shard.snapshot(depth);
                            let subject = subjects::marketdata::l2(symbol);
                            
                            if let Err(e) = transport.publish(&subject, &snapshot).await {
                                warn!(symbol = %symbol, error = %e, "Failed to publish L2");
                            }

                            // Update metrics
                            metrics::set_orderbook_depth(symbol, "bid", snapshot.bids.len());
                            metrics::set_orderbook_depth(symbol, "ask", snapshot.asks.len());
                            metrics::set_open_orders(symbol, shard.order_count());
                        }
                    }
                }
                _ = shutdown_rx.recv() => {
                    info!("Market data loop shutting down");
                    break;
                }
            }
        }
    }

    /// Signal shutdown
    pub fn shutdown(&self) {
        info!("Shutdown signal received");
        let _ = self.shutdown_tx.send(());
    }

    /// Get the shard manager
    pub fn shard_manager(&self) -> &Arc<ShardManager> {
        &self.shard_manager
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_engine_server_creation() {
        let config = EngineConfig::default();
        let server = EngineServer::new(config);
        
        server.init_markets();
        assert!(server.shard_manager.get("BTC-USDT").is_some());
    }
}
