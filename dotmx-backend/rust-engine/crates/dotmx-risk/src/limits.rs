//! Rate limiting and position tracking

use dashmap::DashMap;
use std::sync::atomic::{AtomicU32, Ordering};
use std::time::Instant;

/// Thread-safe rate limiter using token bucket algorithm
pub struct RateLimiter {
    /// User ID -> (last_refill_time, tokens)
    buckets: DashMap<String, TokenBucket>,
    /// Tokens per second
    rate: u32,
    /// Maximum burst size
    burst: u32,
}

struct TokenBucket {
    tokens: AtomicU32,
    last_refill: std::sync::Mutex<Instant>,
}

impl RateLimiter {
    /// Create a new rate limiter
    pub fn new(rate: u32, burst: u32) -> Self {
        Self {
            buckets: DashMap::new(),
            rate,
            burst,
        }
    }

    /// Try to consume a token, returns true if allowed
    pub fn try_acquire(&self, user_id: &str) -> bool {
        let entry = self.buckets.entry(user_id.to_string()).or_insert_with(|| {
            TokenBucket {
                tokens: AtomicU32::new(self.burst),
                last_refill: std::sync::Mutex::new(Instant::now()),
            }
        });

        let bucket = entry.value();
        
        // Refill tokens
        {
            let mut last_refill = bucket.last_refill.lock().unwrap();
            let now = Instant::now();
            let elapsed = now.duration_since(*last_refill);
            let refill = (elapsed.as_secs_f64() * self.rate as f64) as u32;
            
            if refill > 0 {
                let current = bucket.tokens.load(Ordering::Relaxed);
                let new_tokens = (current + refill).min(self.burst);
                bucket.tokens.store(new_tokens, Ordering::Relaxed);
                *last_refill = now;
            }
        }

        // Try to consume
        loop {
            let current = bucket.tokens.load(Ordering::Relaxed);
            if current == 0 {
                return false;
            }
            if bucket.tokens.compare_exchange_weak(
                current,
                current - 1,
                Ordering::SeqCst,
                Ordering::Relaxed,
            ).is_ok() {
                return true;
            }
        }
    }

    /// Get current token count for a user
    pub fn tokens(&self, user_id: &str) -> u32 {
        self.buckets
            .get(user_id)
            .map(|b| b.tokens.load(Ordering::Relaxed))
            .unwrap_or(self.burst)
    }

    /// Clear rate limit state for a user
    pub fn clear(&self, user_id: &str) {
        self.buckets.remove(user_id);
    }
}

/// Track open orders per user
pub struct OpenOrderTracker {
    /// User ID -> count
    counts: DashMap<String, AtomicU32>,
}

impl Default for OpenOrderTracker {
    fn default() -> Self {
        Self::new()
    }
}

impl OpenOrderTracker {
    pub fn new() -> Self {
        Self {
            counts: DashMap::new(),
        }
    }

    /// Increment open order count for a user
    pub fn increment(&self, user_id: &str) -> u32 {
        let entry = self.counts.entry(user_id.to_string()).or_insert_with(|| AtomicU32::new(0));
        entry.fetch_add(1, Ordering::SeqCst) + 1
    }

    /// Decrement open order count for a user
    pub fn decrement(&self, user_id: &str) -> u32 {
        if let Some(entry) = self.counts.get(user_id) {
            let prev = entry.fetch_sub(1, Ordering::SeqCst);
            prev.saturating_sub(1)
        } else {
            0
        }
    }

    /// Get current open order count for a user
    pub fn count(&self, user_id: &str) -> u32 {
        self.counts
            .get(user_id)
            .map(|c| c.load(Ordering::Relaxed))
            .unwrap_or(0)
    }

    /// Clear tracking for a user
    pub fn clear(&self, user_id: &str) {
        self.counts.remove(user_id);
    }
}

/// Position tracker for position limits
pub struct PositionTracker {
    /// (user_id, symbol) -> position (positive = long, negative = short)
    positions: DashMap<(String, String), i64>,
}

impl Default for PositionTracker {
    fn default() -> Self {
        Self::new()
    }
}

impl PositionTracker {
    pub fn new() -> Self {
        Self {
            positions: DashMap::new(),
        }
    }

    /// Update position for a user/symbol
    pub fn update(&self, user_id: &str, symbol: &str, delta: i64) -> i64 {
        let key = (user_id.to_string(), symbol.to_string());
        let mut entry = self.positions.entry(key).or_insert(0);
        let new_position = *entry + delta;
        *entry = new_position;
        new_position
    }

    /// Get current position for a user/symbol
    pub fn position(&self, user_id: &str, symbol: &str) -> i64 {
        let key = (user_id.to_string(), symbol.to_string());
        self.positions.get(&key).map(|p| *p).unwrap_or(0)
    }

    /// Check if adding delta would exceed limits
    pub fn would_exceed_limit(&self, user_id: &str, symbol: &str, delta: i64, max_long: i64, max_short: i64) -> bool {
        let current = self.position(user_id, symbol);
        let new_position = current + delta;
        
        if new_position > 0 && new_position > max_long {
            return true;
        }
        if new_position < 0 && (-new_position) > max_short {
            return true;
        }
        false
    }

    /// Clear position for a user/symbol
    pub fn clear(&self, user_id: &str, symbol: &str) {
        let key = (user_id.to_string(), symbol.to_string());
        self.positions.remove(&key);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;
    use std::time::Duration;

    #[test]
    fn test_rate_limiter() {
        let limiter = RateLimiter::new(10, 5);
        
        // Should allow burst
        for _ in 0..5 {
            assert!(limiter.try_acquire("user1"));
        }
        
        // Should be rate limited
        assert!(!limiter.try_acquire("user1"));
    }

    #[test]
    fn test_rate_limiter_refill() {
        let limiter = RateLimiter::new(1000, 2);
        
        // Consume all tokens
        assert!(limiter.try_acquire("user1"));
        assert!(limiter.try_acquire("user1"));
        assert!(!limiter.try_acquire("user1"));
        
        // Wait for refill
        thread::sleep(Duration::from_millis(10));
        
        // Should have refilled
        assert!(limiter.try_acquire("user1"));
    }

    #[test]
    fn test_open_order_tracker() {
        let tracker = OpenOrderTracker::new();
        
        assert_eq!(tracker.count("user1"), 0);
        
        tracker.increment("user1");
        tracker.increment("user1");
        assert_eq!(tracker.count("user1"), 2);
        
        tracker.decrement("user1");
        assert_eq!(tracker.count("user1"), 1);
    }

    #[test]
    fn test_position_tracker() {
        let tracker = PositionTracker::new();
        
        assert_eq!(tracker.position("user1", "BTC-USDT"), 0);
        
        tracker.update("user1", "BTC-USDT", 100);
        assert_eq!(tracker.position("user1", "BTC-USDT"), 100);
        
        tracker.update("user1", "BTC-USDT", -50);
        assert_eq!(tracker.position("user1", "BTC-USDT"), 50);
    }

    #[test]
    fn test_position_limit_check() {
        let tracker = PositionTracker::new();
        tracker.update("user1", "BTC-USDT", 90);
        
        // Would exceed long limit of 100
        assert!(tracker.would_exceed_limit("user1", "BTC-USDT", 20, 100, 100));
        
        // Would not exceed
        assert!(!tracker.would_exceed_limit("user1", "BTC-USDT", 5, 100, 100));
    }
}
