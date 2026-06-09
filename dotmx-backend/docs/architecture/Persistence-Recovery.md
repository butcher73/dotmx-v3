# Module 07 — Persistence, Replay, Recovery

## Goal
Engine must recover orderbook and order states after crash.

## Journal (Write-Ahead Log)
Per market shard:
- Append every accepted event to a durable log:
  - local disk segment files (fast)
  - or Kafka partition per symbol
  - or Redpanda (Kafka API)

Rules:
- An event is "committed" only after journal append success.
- If journal fails → reject trading for that symbol.

## Replay
On startup:
1) Load latest snapshot (optional, every N seconds)
2) Replay journal from snapshot offset to end
3) Rebuild in-memory book + order states
4) Resume accepting commands

## Snapshotting
- Snapshot L2 book levels + active orders map
- Frequency: e.g., every 1–5 seconds for hot symbols, or every 30s for normal
- Snapshot must include last seq

## Read Model DB
DB is not the truth; it's a projection.
- If DB lags, engine still trades.
- DB can be rebuilt by replaying journal.

## Data Retention
- Keep journal segments for auditing and dispute resolution.
- Compaction strategy:
  - keep raw events for X days
  - keep aggregated trades forever (optional)
