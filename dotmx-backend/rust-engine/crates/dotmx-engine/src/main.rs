//! DotMX Matching Engine Binary
//!
//! High-performance order matching engine written in Rust.

use dotmx_engine::{EngineConfig, EngineServer};
use std::sync::Arc;
use tokio::sync::oneshot;
use tracing::{info, error};
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load .env if exists
    let _ = dotenvy::dotenv();

    // Initialize tracing
    tracing_subscriber::registry()
        .with(fmt::layer().with_target(true))
        .with(EnvFilter::from_default_env().add_directive("dotmx=info".parse()?))
        .init();

    info!("DotMX Matching Engine starting...");

    // Load configuration
    let config = EngineConfig::from_env();
    info!(instance = %config.instance_id, symbols = ?config.symbols, "Configuration loaded");

    // Create and initialize engine server
    let mut server = EngineServer::new(config);
    server.init_markets();

    // Connect to NATS
    info!("Connecting to NATS...");
    server.connect().await?;

    // Setup shutdown handler
    let server = Arc::new(server);
    let server_clone = server.clone();
    
    let (shutdown_tx, shutdown_rx) = oneshot::channel();
    let mut shutdown_tx = Some(shutdown_tx);

    ctrlc::set_handler(move || {
        info!("Received shutdown signal");
        server_clone.shutdown();
        if let Some(tx) = shutdown_tx.take() {
            let _ = tx.send(());
        }
    })?;

    // Run the server
    info!("Engine server starting...");
    
    tokio::select! {
        result = server.run() => {
            if let Err(e) = result {
                error!(error = %e, "Engine server error");
                return Err(e);
            }
        }
        _ = async {
            let _ = shutdown_rx.await;
        } => {
            info!("Shutdown complete");
        }
    }

    Ok(())
}
