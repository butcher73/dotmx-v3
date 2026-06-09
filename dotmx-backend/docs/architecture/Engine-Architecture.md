# Module 02 — Matching Engine Architecture

## Goals
- Deterministic matching
- Single-writer per market shard
- High throughput and low latency

## Core Components
1. **Gateway Adapter**
   - Consumes commands from bus (from API)
   - Normalizes input, basic validation

2. **Market Shard Router**
   - Routes commands to correct market shard (by symbol)
   - Enforces per-market ordering (FIFO for commands)

3. **Market Shard (Single Writer)**
   - In-memory orderbook
   - Matching loop
   - Emits events: OrderAccepted, Trade, OrderPartiallyFilled, OrderFilled, OrderCanceled, Reject

4. **Event Journal (Append Only)**
   - Per market shard, append every state-changing event
   - Enables replay recovery

5. **Read Model Builder**
   - Consumes events, writes to DB / cache
   - Generates L2 snapshots, user order state, trade history
   - Must not block shard hot path

6. **Market Data Fanout**
   - Maintains L2 book state & diffs for WS
   - Applies throttling (e.g., 50ms/100ms)

## Concurrency Model (Recommended)
- **One OS thread / event loop per market shard** (single-writer)
- No locks in matching hot path
- Communication via:
  - bounded queues (SPSC or MPSC) into shard
  - shard emits events into another bounded queue

## Determinism Rules
- Within a market shard:
  - Commands processed in arrival order (or timestamp+sequence)
  - Matching uses strict price-time priority
- If two orders arrive “same time”, tie-break via engine sequence id

## Backpressure
- Each shard queue has max length
- If queue is full:
  - reject new orders for that symbol (or slow-mode)
- API should read these signals and rate-limit upstream

## Data Ownership
- Shard owns:
  - orderbook
  - order states for that symbol
- Everything else is derived from shard events

## Scaling
- Horizontal scale = add more shards and reassign symbols
- Hot symbols can be:
  - isolated on dedicated nodes
  - split by market type (spot/perp) or by account partitioning (advanced)
