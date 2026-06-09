use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use dotmx_core::{
    Orderbook, Order, Side, Symbol, UserId, TimeInForce,
    to_decimal, MatchingEngine,
};

fn create_order(side: Side, price: f64, qty: f64, seq: u64) -> Order {
    Order::new_limit(
        UserId::new("user1"),
        Symbol::new("BTC-USDT"),
        side,
        to_decimal(price),
        to_decimal(qty),
        TimeInForce::GTC,
        seq,
    )
}

fn bench_orderbook_add(c: &mut Criterion) {
    let mut group = c.benchmark_group("orderbook_add");

    for size in [100, 1000, 10000].iter() {
        group.bench_with_input(BenchmarkId::from_parameter(size), size, |b, &size| {
            b.iter(|| {
                let book = Orderbook::new(Symbol::new("BTC-USDT"));
                for i in 0..size {
                    let price = 50000.0 + (i as f64 * 0.01);
                    let order = create_order(Side::Buy, price, 1.0, i as u64);
                    let _ = book.add_order(order);
                }
                black_box(book.order_count())
            });
        });
    }

    group.finish();
}

fn bench_orderbook_match(c: &mut Criterion) {
    let mut group = c.benchmark_group("orderbook_match");

    for depth in [10, 100, 1000].iter() {
        group.bench_with_input(BenchmarkId::from_parameter(depth), depth, |b, &depth| {
            b.iter_batched(
                || {
                    // Setup: create orderbook with asks
                    let engine = MatchingEngine::new(Symbol::new("BTC-USDT"));
                    for i in 0..depth {
                        let price = 50000.0 + (i as f64 * 0.01);
                        let order = Order::new_limit(
                            UserId::new("maker"),
                            Symbol::new("BTC-USDT"),
                            Side::Sell,
                            to_decimal(price),
                            to_decimal(1.0),
                            TimeInForce::GTC,
                            engine.orderbook().next_sequence(),
                        );
                        engine.process_order(order);
                    }
                    engine
                },
                |engine| {
                    // Benchmark: match against all asks
                    let buy = Order::new_limit(
                        UserId::new("taker"),
                        Symbol::new("BTC-USDT"),
                        Side::Buy,
                        to_decimal(60000.0), // High price to match all
                        to_decimal(depth as f64),
                        TimeInForce::GTC,
                        engine.orderbook().next_sequence(),
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

fn bench_orderbook_bbo(c: &mut Criterion) {
    let book = Orderbook::new(Symbol::new("BTC-USDT"));
    // Add 1000 orders on each side
    for i in 0..1000 {
        let bid = create_order(Side::Buy, 50000.0 - (i as f64 * 0.01), 1.0, i as u64);
        let ask = create_order(Side::Sell, 50000.0 + (i as f64 * 0.01), 1.0, (i + 1000) as u64);
        let _ = book.add_order(bid);
        let _ = book.add_order(ask);
    }

    c.bench_function("orderbook_bbo", |b| {
        b.iter(|| {
            black_box((book.best_bid(), book.best_ask()));
        });
    });
}

fn bench_orderbook_throughput(c: &mut Criterion) {
    c.bench_function("orderbook_raw_throughput_10k", |b| {
        b.iter(|| {
            let engine = MatchingEngine::new(Symbol::new("BTC-USDT"));
            for i in 0..10000u64 {
                let side = if i % 2 == 0 { Side::Buy } else { Side::Sell };
                let price = 50000.0 + (i as f64 % 100.0) * 0.01;
                let order = Order::new_limit(
                    UserId::new("user1"),
                    Symbol::new("BTC-USDT"),
                    side,
                    to_decimal(price),
                    to_decimal(1.0),
                    TimeInForce::GTC,
                    engine.orderbook().next_sequence(),
                );
                engine.process_order(order);
            }
            black_box(engine.orderbook().order_count())
        });
    });
}

criterion_group!(
    benches,
    bench_orderbook_add,
    bench_orderbook_match,
    bench_orderbook_bbo,
    bench_orderbook_throughput,
);

criterion_main!(benches);
