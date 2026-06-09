//! Risk Management Module for DotMX Matching Engine
//!
//! Provides pre-trade risk checks including:
//! - Order size limits
//! - Notional value limits
//! - Price deviation checks (circuit breakers)
//! - Position limits
//! - Rate limiting

mod checks;
mod config;
mod limits;

pub use checks::*;
pub use config::*;
pub use limits::*;
