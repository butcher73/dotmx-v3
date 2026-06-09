//! NATS client for the matching engine

use async_nats::{
    Client, ConnectOptions, Message,
    jetstream::{self, Context as JetStreamContext, stream::Config as StreamConfig},
};
use serde::{de::DeserializeOwned, Serialize};
use thiserror::Error;
use tokio::sync::broadcast;
use tracing::{debug, error, info};

use crate::subjects;

#[derive(Debug, Error)]
pub enum TransportError {
    #[error("NATS connection error: {0}")]
    ConnectionError(String),

    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),

    #[error("NATS error: {0}")]
    NatsError(String),

    #[error("JetStream error: {0}")]
    JetStreamError(String),

    #[error("Subscription error: {0}")]
    SubscriptionError(String),
    
    #[error("Publish error: {0}")]
    PublishError(String),

    #[error("Request error: {0}")]
    RequestError(String),

    #[error("Flush error: {0}")]
    FlushError(String),
}

impl From<async_nats::Error> for TransportError {
    fn from(e: async_nats::Error) -> Self {
        TransportError::NatsError(e.to_string())
    }
}

impl From<async_nats::ConnectError> for TransportError {
    fn from(e: async_nats::ConnectError) -> Self {
        TransportError::ConnectionError(e.to_string())
    }
}

/// Configuration for NATS transport
#[derive(Debug, Clone)]
pub struct TransportConfig {
    /// NATS server URLs
    pub urls: Vec<String>,
    /// Client name
    pub name: String,
    /// Enable JetStream
    pub jetstream: bool,
    /// Reconnect buffer size
    pub reconnect_buffer_size: usize,
}

impl Default for TransportConfig {
    fn default() -> Self {
        Self {
            urls: vec!["nats://localhost:4222".to_string()],
            name: "dotmx-engine".to_string(),
            jetstream: true,
            reconnect_buffer_size: 8 * 1024 * 1024, // 8MB
        }
    }
}

/// NATS transport client
pub struct NatsTransport {
    client: Client,
    jetstream: Option<JetStreamContext>,
    #[allow(dead_code)]
    config: TransportConfig,
    shutdown: broadcast::Sender<()>,
}

impl NatsTransport {
    /// Connect to NATS servers
    pub async fn connect(config: TransportConfig) -> Result<Self, TransportError> {
        let urls = config.urls.join(",");
        
        info!(urls = %urls, name = %config.name, "Connecting to NATS");

        let options = ConnectOptions::new()
            .name(&config.name);

        let client: Client = options.connect(&urls).await?;

        let jetstream = if config.jetstream {
            Some(jetstream::new(client.clone()))
        } else {
            None
        };

        let (shutdown, _) = broadcast::channel(1);

        info!("Connected to NATS");

        Ok(Self {
            client,
            jetstream,
            config,
            shutdown,
        })
    }

    /// Get the underlying NATS client
    pub fn client(&self) -> &Client {
        &self.client
    }

    /// Get JetStream context
    pub fn jetstream(&self) -> Option<&JetStreamContext> {
        self.jetstream.as_ref()
    }

    /// Publish a message to a subject
    pub async fn publish<T: Serialize>(
        &self,
        subject: &str,
        payload: &T,
    ) -> Result<(), TransportError> {
        let data = serde_json::to_vec(payload)?;
        self.client.publish(subject.to_string(), data.into()).await
            .map_err(|e| TransportError::PublishError(e.to_string()))?;
        debug!(subject = %subject, "Published message");
        Ok(())
    }

    /// Publish with reply subject
    pub async fn publish_with_reply<T: Serialize>(
        &self,
        subject: &str,
        reply: &str,
        payload: &T,
    ) -> Result<(), TransportError> {
        let data = serde_json::to_vec(payload)?;
        self.client
            .publish_with_reply(subject.to_string(), reply.to_string(), data.into())
            .await
            .map_err(|e| TransportError::PublishError(e.to_string()))?;
        Ok(())
    }

    /// Request-reply pattern
    pub async fn request<T: Serialize, R: DeserializeOwned>(
        &self,
        subject: &str,
        payload: &T,
    ) -> Result<R, TransportError> {
        let data = serde_json::to_vec(payload)?;
        let response = self
            .client
            .request(subject.to_string(), data.into())
            .await
            .map_err(|e| TransportError::RequestError(e.to_string()))?;
        let result: R = serde_json::from_slice(&response.payload)?;
        Ok(result)
    }

    /// Subscribe to a subject
    pub async fn subscribe(
        &self,
        subject: &str,
    ) -> Result<async_nats::Subscriber, TransportError> {
        let subscriber = self.client.subscribe(subject.to_string()).await
            .map_err(|e| TransportError::SubscriptionError(e.to_string()))?;
        info!(subject = %subject, "Subscribed to subject");
        Ok(subscriber)
    }

    /// Create or get a JetStream stream
    pub async fn ensure_stream(&self, name: &str, subjects: &[&str]) -> Result<(), TransportError> {
        let js = self.jetstream.as_ref().ok_or_else(|| {
            TransportError::JetStreamError("JetStream not enabled".to_string())
        })?;

        let config = StreamConfig {
            name: name.to_string(),
            subjects: subjects.iter().map(|s| s.to_string()).collect(),
            ..Default::default()
        };

        match js.get_or_create_stream(config).await {
            Ok(_) => {
                info!(stream = %name, "Stream ready");
                Ok(())
            }
            Err(e) => {
                error!(stream = %name, error = %e, "Failed to create stream");
                Err(TransportError::JetStreamError(e.to_string()))
            }
        }
    }

    /// Setup default streams for the matching engine
    pub async fn setup_streams(&self) -> Result<(), TransportError> {
        // Commands stream
        self.ensure_stream(subjects::streams::COMMANDS, &[subjects::commands::ALL])
            .await?;

        // Events stream
        self.ensure_stream(subjects::streams::EVENTS, &[subjects::events::ALL])
            .await?;

        Ok(())
    }

    /// Get shutdown receiver
    pub fn shutdown_receiver(&self) -> broadcast::Receiver<()> {
        self.shutdown.subscribe()
    }

    /// Signal shutdown
    pub fn shutdown(&self) {
        let _ = self.shutdown.send(());
    }

    /// Flush pending messages
    pub async fn flush(&self) -> Result<(), TransportError> {
        self.client.flush().await
            .map_err(|e| TransportError::FlushError(e.to_string()))?;
        Ok(())
    }

    /// Close the connection
    pub async fn close(self) {
        self.shutdown();
        // Client is dropped automatically
        info!("NATS connection closed");
    }
}

/// Parse a NATS message payload
pub fn parse_message<T: DeserializeOwned>(msg: &Message) -> Result<T, TransportError> {
    serde_json::from_slice(&msg.payload).map_err(TransportError::from)
}

/// Respond to a NATS request
pub async fn respond<T: Serialize>(
    client: &Client,
    msg: &Message,
    payload: &T,
) -> Result<(), TransportError> {
    if let Some(reply) = &msg.reply {
        let data = serde_json::to_vec(payload)?;
        client.publish(reply.clone(), data.into()).await
            .map_err(|e| TransportError::PublishError(e.to_string()))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = TransportConfig::default();
        assert_eq!(config.urls, vec!["nats://localhost:4222"]);
        assert!(config.jetstream);
    }

    // Integration tests would require a running NATS server
}
