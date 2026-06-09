# Module 10 — Testing & Performance Harness

## Correctness Tests
- Price-time priority invariants
- Partial fills, IOC, FOK
- Cancel correctness
- Self-trade prevention policy
- Deterministic replay (same input -> same outputs)

## Determinism Harness
- Record command stream with seq/timestamps
- Replay multiple times; assert identical event log hash

## Load Testing
Create a load generator:
- order rate
- cancel rate
- symbol distribution (Zipf: few hot symbols)
- measure:
  - p50/p99 latency (enqueue->accept, accept->fill)
  - throughput per shard
  - GC pauses
  - queue depth/backpressure events

## Metrics (Minimum)
- orders/sec, cancels/sec, trades/sec per symbol
- match latency p50/p99
- queue depth
- journal append latency
- WS fanout lag
