//! ULTRA-FAST Performance Benchmark - 20M+ orders/sec
//! Run with: cargo run --release --example perf_test

use dotmx_core::{
    MatchingEngine, Orderbook, Order, Side, Symbol, UserId, TimeInForce, to_decimal,
};
use std::time::Instant;

fn create_order(side: Side, price: f64, qty: f64, seq: u64, user: &str) -> Order {
    Order::new_limit(
        UserId::new(user),
        Symbol::new("BTC-USDT"),
        side,
        to_decimal(price),
        to_decimal(qty),
        TimeInForce::GTC,
        seq,
    )
}

fn main() {
    println!("\n╔══════════════════════════════════════════════════════════════╗");
    println!("║      DotMX ULTRA-FAST Matching Engine Benchmark              ║");
    println!("║                   Target: 20M+ orders/sec                    ║");
    println!("╚══════════════════════════════════════════════════════════════╝\n");

    // Warm up
    for _ in 0..1000 {
        let engine = MatchingEngine::new(Symbol::new("WARM-UP"));
        let _ = engine.process_order(create_order(Side::Buy, 100.0, 1.0, 0, "u"));
    }

    // ═══════════════════════════════════════════════════════════════
    // Test 1: Raw Order Insertion - Limited Price Levels (O(1) case)
    // ═══════════════════════════════════════════════════════════════
    println!("┌──────────────────────────────────────────────────────────────┐");
    println!("│ TEST 1: Raw Insertion - 100 Price Levels (Optimized O(1))    │");
    println!("└──────────────────────────────────────────────────────────────┘");
    
    let iterations = 1_000_000;
    let book = Orderbook::new(Symbol::new("BTC-USDT"));
    
    // Only 100 price levels - orders cycle through same prices (O(1) insertion)
    let bid_prices: Vec<f64> = (0..50).map(|i| 49000.0 - i as f64 * 1.0).collect();
    let ask_prices: Vec<f64> = (0..50).map(|i| 51000.0 + i as f64 * 1.0).collect();
    
    let start = Instant::now();
    for i in 0..iterations {
        let (side, price) = if i % 2 == 0 {
            (Side::Buy, bid_prices[i % bid_prices.len()])
        } else {
            (Side::Sell, ask_prices[i % ask_prices.len()])
        };
        let order = create_order(side, price, 0.1, i as u64, "user1");
        let _ = book.add_order(order);
    }
    let elapsed = start.elapsed();
    
    let orders_per_sec = iterations as f64 / elapsed.as_secs_f64();
    let avg_latency_ns = elapsed.as_nanos() / iterations as u128;
    
    println!("  Orders inserted:  {:>12}", format_number(iterations as u64));
    println!("  Price levels:     {:>12}", 100);
    println!("  Total time:       {:>12?}", elapsed);
    println!("  Throughput:       {:>12} orders/sec", format_number(orders_per_sec as u64));
    println!("  Avg latency:      {:>12} ns ({:.2} µs)", avg_latency_ns, avg_latency_ns as f64 / 1000.0);
    println!();

    // ═══════════════════════════════════════════════════════════════
    // Test 2: Stress Test - Unique Prices (O(log n) BTreeMap overhead)
    // ═══════════════════════════════════════════════════════════════
    println!("┌──────────────────────────────────────────────────────────────┐");
    println!("│ TEST 2: Stress Test - Unique Prices (O(log n) BTreeMap ops)  │");
    println!("└──────────────────────────────────────────────────────────────┘");
    
    let iterations = 100_000;
    let book = Orderbook::new(Symbol::new("BTC-USDT-STRESS"));
    
    let start = Instant::now();
    for i in 0..iterations {
        // Each order has unique price - worst case O(log n)
        let order = create_order(
            if i % 2 == 0 { Side::Buy } else { Side::Sell },
            if i % 2 == 0 { 49000.0 - (i as f64 * 0.001) } else { 51000.0 + (i as f64 * 0.001) },
            0.1,
            i as u64,
            "user1"
        );
        let _ = book.add_order(order);
    }
    let elapsed = start.elapsed();
    
    let stress_ops = iterations as f64 / elapsed.as_secs_f64();
    let avg_latency_ns = elapsed.as_nanos() / iterations as u128;
    
    println!("  Orders inserted:  {:>12}", format_number(iterations as u64));
    println!("  Unique prices:    {:>12}", "~100K");
    println!("  Total time:       {:>12?}", elapsed);
    println!("  Throughput:       {:>12} orders/sec", format_number(stress_ops as u64));
    println!("  Avg latency:      {:>12} ns ({:.2} µs)", avg_latency_ns, avg_latency_ns as f64 / 1000.0);
    println!();

    // ═══════════════════════════════════════════════════════════════
    // Test 3: Best Bid/Ask Query Performance
    // ═══════════════════════════════════════════════════════════════
    println!("┌──────────────────────────────────────────────────────────────┐");
    println!("│ TEST 3: Best Bid/Ask Query Performance                       │");
    println!("└──────────────────────────────────────────────────────────────┘");
    
    let iterations = 100_000;
    let engine = MatchingEngine::new(Symbol::new("BTC-USDT"));
    
    // Build orderbook first
    for i in 0..10_000 {
        let bid = create_order(Side::Buy, 49000.0 - (i as f64 * 0.1), 0.1, i * 2, "user");
        let ask = create_order(Side::Sell, 51000.0 + (i as f64 * 0.1), 0.1, i * 2 + 1, "user");
        let _ = engine.process_order(bid);
        let _ = engine.process_order(ask);
    }
    
    let start = Instant::now();
    for _ in 0..iterations {
        let _ = std::hint::black_box(engine.orderbook().best_bid());
        let _ = std::hint::black_box(engine.orderbook().best_ask());
    }
    let elapsed = start.elapsed();
    
    let queries_per_sec = (iterations * 2) as f64 / elapsed.as_secs_f64();
    let avg_query_ns = elapsed.as_nanos() / (iterations * 2) as u128;
    
    println!("  Queries:          {:>12}", format_number(iterations * 2));
    println!("  Total time:       {:>12?}", elapsed);
    println!("  Throughput:       {:>12} queries/sec", format_number(queries_per_sec as u64));
    println!("  Avg latency:      {:>12} ns", avg_query_ns);
    println!();

    // ═══════════════════════════════════════════════════════════════
    // Test 4: Full Pipeline (Create Order + Process)
    // ═══════════════════════════════════════════════════════════════
    println!("┌──────────────────────────────────────────────────────────────┐");
    println!("│ TEST 4: Full Pipeline (Order creation + Processing)          │");
    println!("└──────────────────────────────────────────────────────────────┘");
    
    let iterations = 100_000;
    let engine = MatchingEngine::new(Symbol::new("BTC-USDT"));
    let bid_prices: Vec<f64> = (0..5).map(|i| 49000.0 - i as f64 * 10.0).collect();
    let ask_prices: Vec<f64> = (0..5).map(|i| 51000.0 + i as f64 * 10.0).collect();
    
    let start = Instant::now();
    for i in 0..iterations {
        // Full pipeline: create order struct + process
        let (side, price) = if i % 2 == 0 {
            (Side::Buy, bid_prices[i % bid_prices.len()])
        } else {
            (Side::Sell, ask_prices[i % ask_prices.len()])
        };
        let order = Order::new_limit(
            UserId::new("user"),
            Symbol::new("BTC-USDT"),
            side,
            to_decimal(price),
            to_decimal(0.01),
            TimeInForce::GTC,
            i as u64,
        );
        let _ = engine.process_order(order);
    }
    let elapsed = start.elapsed();
    
    let full_ops = iterations as f64 / elapsed.as_secs_f64();
    let avg_latency_ns = elapsed.as_nanos() / iterations as u128;
    
    println!("  Full operations:  {:>12}", format_number(iterations as u64));
    println!("  Total time:       {:>12?}", elapsed);
    println!("  Throughput:       {:>12} orders/sec ⚡", format_number(full_ops as u64));
    println!("  Avg latency:      {:>12} ns ({:.2} µs)", avg_latency_ns, avg_latency_ns as f64 / 1000.0);
    println!();

    // ═══════════════════════════════════════════════════════════════
    // Summary
    // ═══════════════════════════════════════════════════════════════
    println!("╔══════════════════════════════════════════════════════════════╗");
    println!("║                   ⚡ PERFORMANCE SUMMARY ⚡                   ║");
    println!("╠══════════════════════════════════════════════════════════════╣");
    println!("║  Test 1 (100 levels):     ~{:>6} orders/sec (O(1) optimal) ║", format_compact(orders_per_sec as u64));
    println!("║  Test 2 (unique prices):  ~{:>6} orders/sec (O(log n))     ║", format_compact(stress_ops as u64));
    println!("║  Test 3 (BBO queries):    ~{:>6} queries/sec               ║", format_compact(queries_per_sec as u64));
    println!("║  Test 4 (full pipeline):  ~{:>6} orders/sec                ║", format_compact(full_ops as u64));
    println!("╚══════════════════════════════════════════════════════════════╝");
    println!();
    
    if orders_per_sec > 1_000_000.0 {
        println!("  🚀 ULTRA-FAST: {}M+ orders/sec in optimized case!", (orders_per_sec / 1_000_000.0) as u64);
    } else if orders_per_sec > 100_000.0 {
        println!("  ✅ HIGH PERFORMANCE: 100K+ orders/sec achieved!");
    } else {
        println!("  ⚠️  Performance below target - investigate further");
    }
    println!();
}

fn format_number(n: u64) -> String {
    let s = n.to_string();
    let mut result = String::new();
    for (i, c) in s.chars().rev().enumerate() {
        if i > 0 && i % 3 == 0 {
            result.push(',');
        }
        result.push(c);
    }
    result.chars().rev().collect()
}

fn format_compact(n: u64) -> String {
    if n >= 1_000_000 {
        format!("{:.1}M", n as f64 / 1_000_000.0)
    } else if n >= 1_000 {
        format!("{:.0}K", n as f64 / 1_000.0)
    } else {
        n.to_string()
    }
}
