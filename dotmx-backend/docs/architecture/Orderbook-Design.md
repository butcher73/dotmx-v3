# Module 03 — Orderbook Data Structures

## Requirements
- Price-time priority
- O(log N) insert/cancel, O(1) best bid/ask access
- Efficient iteration for matching

## Recommended Structures
### A) Price Levels Map + FIFO Queue per level
- `bids: Map<price, Level>` descending
- `asks: Map<price, Level>` ascending
- `Level` contains FIFO queue of order IDs (linked list)

Implementation options:
- Balanced tree: red-black tree, BTree (best)
- Skip list (good)
- If tick sizes are dense: array/ring indexing (fast but memory heavy)

### B) Order Index
- `ordersById: Map<orderId, OrderRef>`
  - points to level and node in linked list
- cancel = O(1) locate + O(1) unlink + update level volume

## Order Model (hot path)
Order fields in hot path should be compact:
- orderId (u64)
- userId (u64) or pointer
- side (1 bit)
- price (i64 fixed)
- qtyRemaining (i64)
- ts/seq (u64)

Avoid:
- big strings
- JSON parsing
- dynamic allocations per match

## Level Aggregates
Store aggregates for market data:
- level.totalQty
- level.orderCount
Update on insert/fill/cancel.

## Snapshot & Diff
- Maintain L2 snapshot from levels
- Emit diffs at throttle interval (e.g., 50–100ms)
- For WS consumers:
  - `snapshot` + `diff sequence`
  - enforce monotonic sequence

## Memory Safety
- Pre-allocate order objects from pools (optional but helps latency)
- Reuse buffers
- Avoid GC pauses (important in JS/TS); consider Bun + careful allocation patterns
