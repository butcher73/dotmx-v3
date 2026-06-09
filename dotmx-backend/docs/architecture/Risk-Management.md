# Module 05 — Risk Checks (Fast Path)

## Goal
Block obviously invalid orders before matching, without slowing the hot path.

## Principles
- Keep checks O(1)
- No DB queries in hot path
- Use cached risk state per user per market

## Minimum Checks (Perp)
- Max order size
- Max notional
- Reduce-only toggle (if user under MM)
- Position limits per market
- Global exposure limits
- Price bands (anti-fat-finger): reject if price deviates > X% from mark

## Cached Inputs
Maintain per user:
- collateral (cached)
- current position size
- current open orders notional
- margin requirement estimate
Update cache from ledger events / or via read model.

## Two-Phase Risk
- Phase A (pre-check in engine): fast and conservative
- Phase B (authoritative in ledger/ZK): exact enforcement

If Phase A passes but Phase B fails:
- ledger will reject or revert that event (in future)
- therefore Phase A should be conservative to reduce rejects.
