//! Comprehensive matching engine benchmarks
//!
//! Tests real-world performance scenarios including:
//! - Order throughput (orders per second)
//! - Matching latency at various depths
//! - Risk check overhead
//! - Full order lifecycle

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId, Throughput};
use dotmx_core::{
    Order, Side, Symbol, UserId, TimeInForce, 
    to_decimal, MatchingEngine,
};
use dotmx_risk::{RiskChecker, MarketRiskConfig, UserRiskConfig};

fn create_limit_order(side: Side, price: f64, qty: f64, seq: u64, user: &str) -> Order {
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

/// Benchmark raw order insertion throughput
fn bench_order_throughput(c: &mut Criterion) {
    let mut group = c.benchmark_group("throughput");
    group.throughput(Throughput::Elements(10000));
    
    group.bench_function("insert_10k_orders", |b| {
        b.iter(|| {
            let engine = MatchingEngine::new(Symbol::new("BTC-USDT"));
            
            // Insert 5000 bids and 5000 asks at different price levels (no matching)
            for i in 0..5000u64 {
                let bid = create_limit_order(Side::Buy, 49000.0 - (i as f64 * 0.01), 0.1, i * 2, "user1");
                let ask = create_limit_order(Side::Sell, 51000.0 + (i as f64 * 0.01), 0.1, i * 2 + 1, "user2");
                let _ = engine.process_order(bid);
                let _ = engine.process_order(ask);
            }
            
            black_box(engine.orderbook().order_count())
        });
    });
    
    group.finish();
}

/// Benchmark single order latency with various book depths
fn bench_order_latency(c: &mut Criterion) {
    let mut group = c.benchmark_group("single_order_latency");
    
    for depth in [0, 100, 1000, 10000].iter() {
        group.bench_with_input(BenchmarkId::new("add_order", depth), depth, |b, &depth| {
            let engine = MatchingEngine::new(Symbol::new("BTC-USDT"));
            
            // Pre-populate orderbook
            for i in 0..depth as u64 {
                let ask = create_limit_order(Side::Sell, 51000.0 + (i as f64 * 0.01), 0.1, i, "maker");
                let _ = engine.process_order(ask);
            }
            
            let mut seq = depth as u64;
            b.iter(|| {
                // Add a non-matching order
                let bid = create_limit_order(Side::Buy, 49000.0, 0.1, seq, "taker");
                seq += 1;
                let result = engine.process_order(bid);
                black_box(result.trades.len())
            });
        });
    }
    
    group.finish();
}

/// Benchmark matching performance at various depths
fn bench_matching_latency(c: &mut Criterion) {
    let mut group = c.benchmark_group("matching_latency");
    
    for matches in [1, 5, 10, 50, 100].iter() {
        group.bench_with_input(BenchmarkId::new("match_orders", matches), matches, |b, &matches| {
            b.iter_batched(
                || {
                    let engine = MatchingEngine::new(Symbol::new("BTC-USDT"));
                    // Add asks that will be matched
                    for i in 0..matches as u64 {
                        let ask = create_limit_order(
                            Side::Sell, 
                            50000.0 + (i as f64 * 0.01), 
                            1.0, 
                            i, 
                            "maker"
                        );
                        let _ = engine.process_order(ask);
                    }
                    engine
                },
                |engine| {
                    // Buy order that matches all asks
                    let buy = create_limit_order(
                        Side::Buy, 
                        51000.0, // Price high enough to match all
                        matches as f64,
                        engine.orderbook().next_sequence(),
                        "taker"
                    );
                    let result = engine.process_order(buy);
                    black_box(result.trades.len())
                },
                criterion::BatchSize::SmallInput,
            );
        });
    }
    
    group.finish();
}

/// Benchmark risk check overhead
fn bench_risk_checks(c: &mut Criterion) {
    let mut group = c.benchmark_group("risk_checks");
    
    let market_config = MarketRiskConfig::default();
    let user_config = UserRiskConfig::default();
    let checker = RiskChecker::new(market_config, user_config);
    
    group.bench_function("full_risk_check", |b| {
        let order = create_limit_order(Side::Buy, 50000.0, 1.0, 1, "user1");
        let reference_price = Some(to_decimal(50000.0));
        
        b.iter(|| {
            black_box(checker.check_order(&order, reference_price, 5))
        });
    });
    
    group.finish();
}

/// Benchmark full order lifecycle (place -> match -> events)
fn bench_full_lifecycle(c: &mut Criterion) {
    let mut group = c.benchmark_group("full_lifecycle");
    
    group.bench_function("place_and_match", |b| {
        b.iter_batched(
            || {
                let engine = MatchingEngine::new(Symbol::new("BTC-USDT"));
                // Add 100 asks
                for i in 0..100u64 {
                    let ask = create_limit_order(Side::Sell, 50000.0 + (i as f64), 0.1, i, "maker");
                    let _ = engine.process_order(ask);
                }
                
                let market_config = MarketRiskConfig::default();
                let user_config = UserRiskConfig::default();
                let checker = RiskChecker::new(market_config, user_config);
                
                (engine, checker)
            },
            |(engine, checker)| {
                // Full lifecycle: risk check + place + match
                let order = create_limit_order(
                    Side::Buy, 
                    50050.0, // Match ~50 orders
                    5.0,
                    engine.orderbook().next_sequence(),
                    "taker"
                );
                
                // Calculate mid price from best bid/ask
                let reference_price = match (engine.orderbook().best_bid(), engine.orderbook().best_ask()) {
                    (Some((bid, _)), Some((ask, _))) => Some((bid + ask) / to_decimal(2.0)),
                    _ => None,
                };
                let risk_result = checker.check_order(&order, reference_price, 0);
                
                if risk_result.is_passed() {
                    let result = engine.process_order(order);
                    black_box(result.trades.len())
                } else {
                    black_box(0)
                }
            },
            criterion::BatchSize::SmallInput,
        );
    });
    
    group.finish();
}

/// Benchmark orderbook best bid/ask queries
fn bench_orderbook_query(c: &mut Criterion) {
    let mut group = c.benchmark_group("orderbook_query");
    
    // Create a pre-populated orderbook
    let engine = MatchingEngine::new(Symbol::new("BTC-USDT"));
    for i in 0..1000u64 {
        let bid = create_limit_order(Side::Buy, 49000.0 - (i as f64 * 0.1), 0.1 + (i as f64 * 0.001), i * 2, "user");
        let ask = create_limit_order(Side::Sell, 51000.0 + (i as f64 * 0.1), 0.1 + (i as f64 * 0.001), i * 2 + 1, "user");
        let _ = engine.process_order(bid);
        let _ = engine.process_order(ask);
    }
    
    group.bench_function("best_bid_ask", |b| {
        b.iter(|| {
            black_box((engine.orderbook().best_bid(), engine.orderbook().best_ask()))
        });
    });
    
    group.finish();
}

criterion_group!(
    benches,
    bench_order_throughput,
    bench_order_latency,
    bench_matching_latency,
    bench_risk_checks,
    bench_full_lifecycle,
    bench_orderbook_query,
);

criterion_main!(benches);
