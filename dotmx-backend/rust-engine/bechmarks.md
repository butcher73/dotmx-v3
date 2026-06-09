
╔══════════════════════════════════════════════════════════════╗
║      DotMX ULTRA-FAST Matching Engine Benchmark              ║
║                   Target: 20M+ orders/sec                    ║
╚══════════════════════════════════════════════════════════════╝

┌──────────────────────────────────────────────────────────────┐
│ TEST 1: Raw Insertion - 100 Price Levels (Optimized O(1))    │
└──────────────────────────────────────────────────────────────┘
  Orders inserted:     1,000,000
  Price levels:              100
  Total time:        81.957792ms
  Throughput:         12,201,402 orders/sec
  Avg latency:                81 ns (0.08 µs)

┌──────────────────────────────────────────────────────────────┐
│ TEST 2: Stress Test - Unique Prices (O(log n) BTreeMap ops)  │
└──────────────────────────────────────────────────────────────┘
  Orders inserted:       100,000
  Unique prices:           ~100K
  Total time:        76.798667ms
  Throughput:          1,302,105 orders/sec
  Avg latency:               767 ns (0.77 µs)

┌──────────────────────────────────────────────────────────────┐
│ TEST 3: Best Bid/Ask Query Performance                       │
└──────────────────────────────────────────────────────────────┘
  Queries:               200,000
  Total time:          807.083µs
  Throughput:        247,805,987 queries/sec
  Avg latency:                 4 ns

┌──────────────────────────────────────────────────────────────┐
│ TEST 4: Full Pipeline (Order creation + Processing)          │
└──────────────────────────────────────────────────────────────┘
  Full operations:       100,000
  Total time:        11.547666ms
  Throughput:          8,659,758 orders/sec ⚡
  Avg latency:               115 ns (0.12 µs)

╔══════════════════════════════════════════════════════════════╗
║                   ⚡ PERFORMANCE SUMMARY ⚡                   ║
╠══════════════════════════════════════════════════════════════╣
║  Test 1 (100 levels):     ~ 12.2M orders/sec (O(1) optimal) ║
║  Test 2 (unique prices):  ~  1.3M orders/sec (O(log n))     ║
║  Test 3 (BBO queries):    ~247.8M queries/sec               ║
║  Test 4 (full pipeline):  ~  8.7M orders/sec                ║
╚══════════════════════════════════════════════════════════════╝

  🚀 ULTRA-FAST: 12M+ orders/sec in optimized case!

