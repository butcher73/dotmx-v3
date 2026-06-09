# Module 08 — Sharding, Scaling, Deployment (Binance-like)

## Primary Scaling Lever: Shard by Symbol
- Each symbol handled by one shard (single writer)
- Shard can be:
  - process
  - thread
  - container
  - node

## Routing
- Router maps symbol -> shard
- Router can live in:
  - API (client sends directly to shard endpoint)
  - dedicated router service
  - message bus subjects

## Hot Symbol Strategy
- Put BTCUSDT, ETHUSDT on dedicated nodes
- Separate market-data fanout infra for hot symbols
- Increase snapshot rate only for hot symbols

## Multi-Region
For true HFT, choose one "primary" region.
- Multi-region active-active adds latency and complexity.
- Better approach:
  - region-local read endpoints
  - single-region matching
  - replicate journal/events globally for viewing

## Capacity Planning
Track:
- orders/sec per symbol
- cancels/sec per symbol
- trades/sec per symbol
- depth update frequency
- WS subscribers

Scale steps:
1) more shards
2) isolate hot symbols
3) optimize allocations/GC
4) move event journal to faster infra (NVMe, Redpanda)
5) split market data pipeline (separate cluster)

## Reliability
- bounded queues + backpressure
- circuit breakers on DB / downstream
- fail-closed on journal errors
