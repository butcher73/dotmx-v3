//! Engine configuration

use dotmx_risk::MarketRiskConfig;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Main engine configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineConfig {
    /// Engine instance ID
    pub instance_id: String,
    
    /// Symbols this engine handles
    pub symbols: Vec<String>,
    
    /// NATS configuration
    pub nats: NatsConfig,
    
    /// Metrics configuration
    pub metrics: MetricsConfig,
    
    /// Market configurations
    pub markets: HashMap<String, MarketRiskConfig>,
    
    /// Orderbook snapshot depth for L2 publishing
    pub l2_depth: usize,
    
    /// Market data publish interval (ms)
    pub marketdata_interval_ms: u64,
}

impl Default for EngineConfig {
    fn default() -> Self {
        Self {
            instance_id: "engine-1".to_string(),
            symbols: vec!["BTC-USDT".to_string(), "ETH-USDT".to_string()],
            nats: NatsConfig::default(),
            metrics: MetricsConfig::default(),
            markets: HashMap::new(),
            l2_depth: 20,
            marketdata_interval_ms: 100,
        }
    }
}

/// NATS configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NatsConfig {
    /// NATS server URLs
    pub urls: Vec<String>,
    
    /// Enable JetStream
    pub jetstream: bool,
    
    /// Reconnect buffer size (bytes)
    pub reconnect_buffer_size: usize,
}

impl Default for NatsConfig {
    fn default() -> Self {
        Self {
            urls: vec!["nats://localhost:4222".to_string()],
            jetstream: true,
            reconnect_buffer_size: 8 * 1024 * 1024,
        }
    }
}

/// Metrics configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsConfig {
    /// Enable Prometheus metrics
    pub enabled: bool,
    
    /// Metrics server bind address
    pub bind: String,
    
    /// Metrics server port
    pub port: u16,
}

impl Default for MetricsConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            bind: "0.0.0.0".to_string(),
            port: 9090,
        }
    }
}

impl EngineConfig {
    /// Load configuration from environment and files
    pub fn load() -> Result<Self, config::ConfigError> {
        let settings = config::Config::builder()
            // Start with defaults
            .add_source(config::Config::try_from(&EngineConfig::default())?)
            // Override with config file if exists
            .add_source(config::File::with_name("config/engine").required(false))
            // Override with environment variables (DOTMX_*)
            .add_source(
                config::Environment::with_prefix("DOTMX")
                    .separator("_")
                    .try_parsing(true),
            )
            .build()?;

        settings.try_deserialize()
    }

    /// Load from a specific file
    pub fn from_file(path: &str) -> Result<Self, config::ConfigError> {
        let settings = config::Config::builder()
            .add_source(config::Config::try_from(&EngineConfig::default())?)
            .add_source(config::File::with_name(path))
            .build()?;

        settings.try_deserialize()
    }

    /// Create from environment variables only
    pub fn from_env() -> Self {
        let mut config = Self::default();

        if let Ok(urls) = std::env::var("NATS_URLS") {
            config.nats.urls = urls.split(',').map(|s| s.trim().to_string()).collect();
        }

        if let Ok(symbols) = std::env::var("ENGINE_SYMBOLS") {
            config.symbols = symbols.split(',').map(|s| s.trim().to_string()).collect();
        }

        if let Ok(id) = std::env::var("ENGINE_INSTANCE_ID") {
            config.instance_id = id;
        }

        if let Ok(port) = std::env::var("METRICS_PORT") {
            if let Ok(p) = port.parse() {
                config.metrics.port = p;
            }
        }

        config
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = EngineConfig::default();
        assert_eq!(config.instance_id, "engine-1");
        assert!(!config.symbols.is_empty());
        assert!(config.nats.jetstream);
    }

    #[test]
    fn test_from_env() {
        std::env::set_var("ENGINE_INSTANCE_ID", "test-engine");
        let config = EngineConfig::from_env();
        assert_eq!(config.instance_id, "test-engine");
        std::env::remove_var("ENGINE_INSTANCE_ID");
    }
}
