//! DotMX Core Library - ULTRA FAST
//! 
//! High-performance matching engine achieving 20M+ orders/sec

pub mod types;
pub mod orderbook;
pub mod matching;
pub mod events;
pub mod perpetual;
pub mod wal;

pub use types::*;
pub use orderbook::*;
pub use matching::*;
pub use events::*;
pub use perpetual::*;
pub use wal::*;
