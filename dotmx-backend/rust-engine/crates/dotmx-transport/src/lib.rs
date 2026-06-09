//! NATS Transport Layer for DotMX Matching Engine
//!
//! Provides async communication with the NATS message bus for:
//! - Receiving commands from the API gateway
//! - Publishing events to subscribers
//! - Market data distribution

mod client;
pub mod subjects;
mod handlers;

pub use client::*;
pub use handlers::*;
