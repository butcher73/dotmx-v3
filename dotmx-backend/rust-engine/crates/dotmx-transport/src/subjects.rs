//! NATS subject definitions

/// Commands from gateway to engine
pub mod commands {
    /// Place order command: `engine.{symbol}.order.place`
    pub fn place_order(symbol: &str) -> String {
        format!("engine.{}.order.place", symbol)
    }

    /// Cancel order command: `engine.{symbol}.order.cancel`
    pub fn cancel_order(symbol: &str) -> String {
        format!("engine.{}.order.cancel", symbol)
    }

    /// Modify order command: `engine.{symbol}.order.modify`
    pub fn modify_order(symbol: &str) -> String {
        format!("engine.{}.order.modify", symbol)
    }

    /// All commands for a symbol: `engine.{symbol}.order.*`
    pub fn all_for_symbol(symbol: &str) -> String {
        format!("engine.{}.order.*", symbol)
    }

    /// All engine commands: `engine.>`
    pub const ALL: &str = "engine.>";
}

/// Events from engine to subscribers
pub mod events {
    /// Order events: `events.{symbol}.order.{event_type}`
    pub fn order_event(symbol: &str, event_type: &str) -> String {
        format!("events.{}.order.{}", symbol, event_type)
    }

    /// Trade events: `events.{symbol}.trade`
    pub fn trade(symbol: &str) -> String {
        format!("events.{}.trade", symbol)
    }

    /// Orderbook updates: `events.{symbol}.orderbook`
    pub fn orderbook(symbol: &str) -> String {
        format!("events.{}.orderbook", symbol)
    }

    /// All events for a symbol: `events.{symbol}.>`
    pub fn all_for_symbol(symbol: &str) -> String {
        format!("events.{}.>", symbol)
    }

    /// All events: `events.>`
    pub const ALL: &str = "events.>";
}

/// Market data subjects
pub mod marketdata {
    /// L2 orderbook snapshot: `md.{symbol}.l2`
    pub fn l2(symbol: &str) -> String {
        format!("md.{}.l2", symbol)
    }

    /// L3 orderbook (full depth): `md.{symbol}.l3`
    pub fn l3(symbol: &str) -> String {
        format!("md.{}.l3", symbol)
    }

    /// Trades: `md.{symbol}.trades`
    pub fn trades(symbol: &str) -> String {
        format!("md.{}.trades", symbol)
    }

    /// Ticker: `md.{symbol}.ticker`
    pub fn ticker(symbol: &str) -> String {
        format!("md.{}.ticker", symbol)
    }
}

/// User-specific subjects
pub mod user {
    /// User order updates: `user.{user_id}.orders`
    pub fn orders(user_id: &str) -> String {
        format!("user.{}.orders", user_id)
    }

    /// User trade notifications: `user.{user_id}.trades`
    pub fn trades(user_id: &str) -> String {
        format!("user.{}.trades", user_id)
    }

    /// User positions: `user.{user_id}.positions`
    pub fn positions(user_id: &str) -> String {
        format!("user.{}.positions", user_id)
    }
}

/// JetStream stream names
pub mod streams {
    /// Commands stream (durable)
    pub const COMMANDS: &str = "COMMANDS";
    
    /// Events stream (durable)
    pub const EVENTS: &str = "EVENTS";
    
    /// Market data stream (ephemeral, high throughput)
    pub const MARKETDATA: &str = "MARKETDATA";
}

/// JetStream consumer names
pub mod consumers {
    /// Engine consumer for commands
    pub fn engine(symbol: &str) -> String {
        format!("engine-{}", symbol.to_lowercase().replace('-', "_"))
    }
    
    /// Persistence consumer for events
    pub const PERSISTENCE: &str = "persistence";
    
    /// Market data publisher consumer
    pub const MARKETDATA_PUBLISHER: &str = "marketdata-publisher";
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_command_subjects() {
        assert_eq!(commands::place_order("BTC-USDT"), "engine.BTC-USDT.order.place");
        assert_eq!(commands::cancel_order("ETH-USDT"), "engine.ETH-USDT.order.cancel");
    }

    #[test]
    fn test_event_subjects() {
        assert_eq!(events::trade("BTC-USDT"), "events.BTC-USDT.trade");
        assert_eq!(events::orderbook("ETH-USDT"), "events.ETH-USDT.orderbook");
    }

    #[test]
    fn test_marketdata_subjects() {
        assert_eq!(marketdata::l2("BTC-USDT"), "md.BTC-USDT.l2");
        assert_eq!(marketdata::trades("BTC-USDT"), "md.BTC-USDT.trades");
    }
}
