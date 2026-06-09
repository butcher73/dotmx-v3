# Module 06 — Event Model & Sequencing

## Why it matters
Binance-like scalability relies on a clean event stream:
- deterministic
- replayable
- append-only

## Event Streams
- Per market shard:
  - `market.<symbol>.events` (ordered)
- Global:
  - `global.events` (optional, derived)

## Event Envelope (recommended)
- eventId (u128 or uuid)
- seq (u64) monotonic per market
- ts (u64 ms)
- symbol
- kind
- payload (compact binary preferred)

## Exactly-Once vs At-Least-Once
Inside a single process shard:
- you have exactly-once by design.
Across services:
- assume at-least-once delivery
- make consumers idempotent by (eventId, seq)

## Ordering
Consumers must process by seq; if gaps:
- wait briefly
- or request replay from journal
