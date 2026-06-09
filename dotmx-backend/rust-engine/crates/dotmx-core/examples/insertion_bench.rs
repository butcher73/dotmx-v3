//! Quick insertion benchmark - optimized for speed measurement
use dotmx_core::{Orderbook, Order, Side, Symbol, UserId, TimeInForce, to_decimal};
use std::time::Instant;

fn main() {
    let book = Orderbook::new(Symbol::new("BTC-USDT"));
    
    // Warm up
    for i in 0..1000u64 {
        let order = Order::new_limit(
            UserId::new("u1"),
            Symbol::new("BTC-USDT"),
            Side::Buy,
            to_decimal(50000.0),
            to_decimal(0.1),
            TimeInForce::GTC,
            i,
        );
        let _ = book.add_order(order);
    }
    
    // Actual test: 1M orders
    let count = 1_000_000u64;
    let start = Instant::now();
    
    for i in 0..count {
        let side = if i % 2 == 0 { Side::Buy } else { Side::Sell };
        let price = if i % 2 == 0 {
            50000.0 - (i % 100) as f64 * 10.0
        } else {
            50000.0 + (i % 100) as f64 * 10.0
        };
        
        let order = Order::new_limit(
            UserId::new("u1"),
            Symbol::new("BTC-USDT"),
            side,
            to_decimal(price),
            to_decimal(0.1),
            TimeInForce::GTC,
            i,
        );
        let _ = book.add_order(order);
    }
    
    let elapsed = start.elapsed();
    let orders_per_sec = count as f64 / elapsed.as_secs_f64();
    let latency_ns = elapsed.as_nanos() / count as u128;
    
    println!("Raw Insertion Benchmark");
    println!("======================");
    println!("Orders:     {:>12}", count);
    println!("Time:       {:>12.3}s", elapsed.as_secs_f64());
    println!("Throughput: {:>12.0} orders/sec", orders_per_sec);
    println!("Latency:    {:>12} ns ({:.3}µs)", latency_ns, latency_ns as f64 / 1000.0);
    println!("\nFinal order count: {}", book.order_count());
}
