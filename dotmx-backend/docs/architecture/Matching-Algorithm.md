# Module 04 — Matching Algorithm (Price-Time Priority)

## Matching Inputs
Incoming order (taker):
- side, price (if limit), qty, type (limit/market), tif (GTC/IOC/FOK)

Maker orders sit in book at price levels.

## Core Matching Rules
- Taker BUY matches best ASK (lowest ask) while:
  - `bestAskPrice <= takerPrice` (limit) OR taker is market
- Taker SELL matches best BID (highest bid) while:
  - `bestBidPrice >= takerPrice` (limit) OR taker is market
- Fill quantity = min(takerRemaining, makerRemaining)

## Time Priority
Within a price level, makers are matched FIFO.
Do not reorder makers under any circumstances.

## Edge Cases
### Partial Fill
- If taker not fully filled and tif=GTC, remainder rests on book (limit only)
- If tif=IOC, remainder canceled immediately
- If tif=FOK, if not fully fillable at submit-time → reject (no partials)

### Market Order
- Must have max slippage control:
  - `maxNotional` or `worstPrice`
- If book insufficient: fill what possible then cancel remainder (or reject—pick policy)

### Self-Trade Prevention (Optional)
- If maker.userId == taker.userId:
  - cancel maker or reject taker or skip maker (policy)
  - must be deterministic

### Tick Size & Lot Size
- Validate:
  - price % tickSize == 0
  - qty % lotSize == 0
- Reject invalid immediately in shard

## Outputs (Events)
- OrderAccepted(orderId)
- Trade(tradeId, makerOrderId, takerOrderId, price, qty)
- OrderPartiallyFilled(orderId, remaining)
- OrderFilled(orderId)
- OrderResting(orderId, remaining) (if placed on book)
- OrderCanceled(orderId)
- Reject(orderId, reason)

## Fees (Engine vs Ledger)
For phase 1, engine can compute fees for UX, but ledger should be final authority.
If no ledger yet:
- engine emits fee fields in Trade event anyway for future compatibility.
