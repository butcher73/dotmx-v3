//! Perpetual futures types and logic
//!
//! Implements leverage trading, position management, funding rates,
//! mark price calculation, and liquidation logic.

use crate::types::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};

// ============================================================================
// LEVERAGE
// ============================================================================

/// Leverage multiplier (stored as fixed-point: 10x = 10_00000000)
pub type Leverage = Decimal;

/// Convert f64 leverage to fixed-point
#[inline]
pub fn to_leverage(value: f64) -> Leverage {
    to_decimal(value)
}

/// Convert fixed-point leverage to f64
#[inline]
pub fn from_leverage(value: Leverage) -> f64 {
    from_decimal(value)
}

/// Minimum leverage (1x)
pub const MIN_LEVERAGE: Leverage = DECIMAL_PLACES; // 1.0

/// Maximum leverage (50x)
pub const MAX_LEVERAGE: Leverage = 50 * DECIMAL_PLACES; // 50.0

/// Validate leverage is within bounds
#[inline]
pub fn validate_leverage(leverage: Leverage) -> bool {
    leverage >= MIN_LEVERAGE && leverage <= MAX_LEVERAGE
}

/// Calculate required margin for a position
/// margin = notional / leverage = (price * quantity) / leverage
#[inline]
pub fn calculate_margin(price: Decimal, quantity: Decimal, leverage: Leverage) -> Decimal {
    let notional = mul_decimal(price, quantity);
    div_decimal(notional, leverage)
}

/// Calculate liquidation price for a long position
/// liq_price = entry_price * (1 - 1/leverage + maintenance_margin_rate)
/// Simplified: liq_price = entry_price - (margin / quantity)
#[inline]
pub fn liquidation_price_long(
    entry_price: Decimal,
    margin: Decimal,
    quantity: Decimal,
    maintenance_margin_rate: Decimal,
) -> Decimal {
    let margin_per_unit = div_decimal(margin, quantity);
    let maintenance = mul_decimal(entry_price, maintenance_margin_rate);
    entry_price - margin_per_unit + maintenance
}

/// Calculate liquidation price for a short position
/// liq_price = entry_price + (margin / quantity) - maintenance
#[inline]
pub fn liquidation_price_short(
    entry_price: Decimal,
    margin: Decimal,
    quantity: Decimal,
    maintenance_margin_rate: Decimal,
) -> Decimal {
    let margin_per_unit = div_decimal(margin, quantity);
    let maintenance = mul_decimal(entry_price, maintenance_margin_rate);
    entry_price + margin_per_unit - maintenance
}

// ============================================================================
// POSITION MANAGEMENT
// ============================================================================

/// Position direction
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PositionSide {
    Long,
    Short,
}

impl From<Side> for PositionSide {
    fn from(side: Side) -> Self {
        match side {
            Side::Buy => PositionSide::Long,
            Side::Sell => PositionSide::Short,
        }
    }
}

/// Unique position identifier
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct PositionId(pub u64);

static POSITION_ID_COUNTER: AtomicU64 = AtomicU64::new(1);

impl PositionId {
    #[inline]
    pub fn new() -> Self {
        Self(POSITION_ID_COUNTER.fetch_add(1, AtomicOrdering::Relaxed))
    }

    #[inline]
    pub fn from_u64(val: u64) -> Self {
        Self(val)
    }
}

impl Default for PositionId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for PositionId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// A user's position in a perpetual market
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub id: PositionId,
    pub user_id: UserId,
    pub symbol: Symbol,
    pub side: PositionSide,
    /// Total position size (always positive)
    pub size: Decimal,
    /// Average entry price
    pub entry_price: Decimal,
    /// Leverage used
    pub leverage: Leverage,
    /// Initial margin deposited
    pub margin: Decimal,
    /// Liquidation price
    pub liquidation_price: Decimal,
    /// Realized P&L (from partial closes)
    pub realized_pnl: Decimal,
    /// Timestamp of position open
    pub created_at: Timestamp,
    /// Last update timestamp
    pub updated_at: Timestamp,
}

impl Position {
    /// Create a new long position from a trade
    pub fn new_long(
        user_id: UserId,
        symbol: Symbol,
        size: Decimal,
        entry_price: Decimal,
        leverage: Leverage,
        maintenance_margin_rate: Decimal,
    ) -> Self {
        let margin = calculate_margin(entry_price, size, leverage);
        let liq_price = liquidation_price_long(entry_price, margin, size, maintenance_margin_rate);
        let now = now_nanos();
        Self {
            id: PositionId::new(),
            user_id,
            symbol,
            side: PositionSide::Long,
            size,
            entry_price,
            leverage,
            margin,
            liquidation_price: liq_price,
            realized_pnl: 0,
            created_at: now,
            updated_at: now,
        }
    }

    /// Create a new short position from a trade
    pub fn new_short(
        user_id: UserId,
        symbol: Symbol,
        size: Decimal,
        entry_price: Decimal,
        leverage: Leverage,
        maintenance_margin_rate: Decimal,
    ) -> Self {
        let margin = calculate_margin(entry_price, size, leverage);
        let liq_price = liquidation_price_short(entry_price, margin, size, maintenance_margin_rate);
        let now = now_nanos();
        Self {
            id: PositionId::new(),
            user_id,
            symbol,
            side: PositionSide::Short,
            size,
            entry_price,
            leverage,
            margin,
            liquidation_price: liq_price,
            realized_pnl: 0,
            created_at: now,
            updated_at: now,
        }
    }

    /// Calculate unrealized P&L given current mark price
    #[inline]
    pub fn unrealized_pnl(&self, mark_price: Decimal) -> Decimal {
        match self.side {
            PositionSide::Long => {
                // (mark_price - entry_price) * size
                mul_decimal(mark_price - self.entry_price, self.size)
            }
            PositionSide::Short => {
                // (entry_price - mark_price) * size
                mul_decimal(self.entry_price - mark_price, self.size)
            }
        }
    }

    /// Calculate total P&L (realized + unrealized)
    #[inline]
    pub fn total_pnl(&self, mark_price: Decimal) -> Decimal {
        self.realized_pnl + self.unrealized_pnl(mark_price)
    }

    /// Calculate margin ratio (used for liquidation checks)
    /// margin_ratio = (margin + unrealized_pnl) / notional
    #[inline]
    pub fn margin_ratio(&self, mark_price: Decimal) -> f64 {
        let notional = mul_decimal(mark_price, self.size);
        if notional == 0 {
            return 1.0;
        }
        let equity = self.margin + self.unrealized_pnl(mark_price);
        from_decimal(div_decimal(equity, notional))
    }

    /// Check if position should be liquidated
    #[inline]
    pub fn should_liquidate(&self, mark_price: Decimal) -> bool {
        match self.side {
            PositionSide::Long => mark_price <= self.liquidation_price,
            PositionSide::Short => mark_price >= self.liquidation_price,
        }
    }

    /// Increase position size (average up/down)
    pub fn increase(
        &mut self,
        additional_size: Decimal,
        price: Decimal,
        leverage: Leverage,
        maintenance_margin_rate: Decimal,
    ) {
        // Calculate new average entry price
        let old_notional = mul_decimal(self.entry_price, self.size);
        let new_notional = mul_decimal(price, additional_size);
        let total_size = self.size + additional_size;
        self.entry_price = div_decimal(old_notional + new_notional, total_size);
        self.size = total_size;

        // Calculate margin: if leverage changed, recalculate total; otherwise add new portion
        let old_margin = self.margin;
        if self.leverage != leverage {
            // Leverage changed — recalculate entire margin at new leverage
            self.margin = calculate_margin(self.entry_price, self.size, leverage);
        } else {
            // Same leverage — add margin for the new portion only
            // This preserves the original margin that was actually deducted from the account
            let new_portion_margin = calculate_margin(price, additional_size, leverage);
            self.margin = old_margin + new_portion_margin;
        }
        self.leverage = leverage;
        self.liquidation_price = match self.side {
            PositionSide::Long => liquidation_price_long(
                self.entry_price,
                self.margin,
                self.size,
                maintenance_margin_rate,
            ),
            PositionSide::Short => liquidation_price_short(
                self.entry_price,
                self.margin,
                self.size,
                maintenance_margin_rate,
            ),
        };
        self.updated_at = now_nanos();
    }

    /// Decrease position size (partial close)
    /// Returns (realized_pnl, released_margin) — the caller must credit released_margin
    /// back to the user's available balance.
    pub fn decrease(
        &mut self,
        close_size: Decimal,
        close_price: Decimal,
        maintenance_margin_rate: Decimal,
    ) -> (Decimal, Decimal) {
        let close_size = close_size.min(self.size);

        // Calculate realized P&L for the closed portion
        let pnl = match self.side {
            PositionSide::Long => mul_decimal(close_price - self.entry_price, close_size),
            PositionSide::Short => mul_decimal(self.entry_price - close_price, close_size),
        };

        self.realized_pnl += pnl;
        self.size -= close_size;

        let old_margin = self.margin;
        let released_margin: Decimal;

        // Recalculate margin for remaining position
        if self.size > 0 {
            self.margin = calculate_margin(self.entry_price, self.size, self.leverage);
            self.liquidation_price = match self.side {
                PositionSide::Long => liquidation_price_long(
                    self.entry_price,
                    self.margin,
                    self.size,
                    maintenance_margin_rate,
                ),
                PositionSide::Short => liquidation_price_short(
                    self.entry_price,
                    self.margin,
                    self.size,
                    maintenance_margin_rate,
                ),
            };
            released_margin = old_margin - self.margin;
        } else {
            self.margin = 0;
            released_margin = old_margin; // All margin released on full close
        }
        self.updated_at = now_nanos();

        (pnl, released_margin)
    }

    /// Check if position is closed (size = 0)
    #[inline]
    pub fn is_closed(&self) -> bool {
        self.size <= 0
    }

    /// Get notional value at current mark price
    #[inline]
    pub fn notional(&self, mark_price: Decimal) -> Decimal {
        mul_decimal(mark_price, self.size)
    }
}

/// Position manager tracks all positions across users and symbols
pub struct PositionManager {
    /// (user_id, symbol) -> Position
    positions: parking_lot::RwLock<HashMap<(UserId, Symbol), Position>>,
}

impl Default for PositionManager {
    fn default() -> Self {
        Self::new()
    }
}

impl PositionManager {
    pub fn new() -> Self {
        Self {
            positions: parking_lot::RwLock::new(HashMap::new()),
        }
    }

    /// Get a position for a user/symbol
    pub fn get_position(&self, user_id: &UserId, symbol: &Symbol) -> Option<Position> {
        self.positions.read().get(&(*user_id, *symbol)).cloned()
    }

    /// Get all positions for a user
    pub fn get_user_positions(&self, user_id: &UserId) -> Vec<Position> {
        self.positions
            .read()
            .iter()
            .filter(|((uid, _), _)| uid == user_id)
            .map(|(_, pos)| pos.clone())
            .collect()
    }

    /// Get all positions (for liquidation scanning)
    pub fn all_positions(&self) -> Vec<Position> {
        self.positions.read().values().cloned().collect()
    }

    /// Open or increase a position from a trade
    pub fn update_from_trade(
        &self,
        user_id: UserId,
        symbol: Symbol,
        side: Side,
        size: Decimal,
        price: Decimal,
        leverage: Leverage,
        maintenance_margin_rate: Decimal,
    ) -> Position {
        let mut positions = self.positions.write();
        let key = (user_id, symbol);
        let position_side = PositionSide::from(side);

        if let Some(existing) = positions.get_mut(&key) {
            if existing.side == position_side {
                // Same direction: increase position
                existing.increase(size, price, leverage, maintenance_margin_rate);
                existing.clone()
            } else {
                // Opposite direction: reduce or flip
                if size < existing.size {
                    // Partial close
                    existing.decrease(size, price, maintenance_margin_rate);
                    existing.clone()
                } else if size == existing.size {
                    // Full close
                    existing.decrease(size, price, maintenance_margin_rate);
                    let closed = existing.clone();
                    positions.remove(&key);
                    closed
                } else {
                    // Flip position
                    let remaining = size - existing.size;
                    existing.decrease(existing.size, price, maintenance_margin_rate);
                    let realized = existing.realized_pnl;

                    // Create new position in opposite direction
                    let mut new_pos = match position_side {
                        PositionSide::Long => Position::new_long(
                            user_id,
                            symbol,
                            remaining,
                            price,
                            leverage,
                            maintenance_margin_rate,
                        ),
                        PositionSide::Short => Position::new_short(
                            user_id,
                            symbol,
                            remaining,
                            price,
                            leverage,
                            maintenance_margin_rate,
                        ),
                    };
                    new_pos.realized_pnl = realized;
                    positions.insert(key, new_pos.clone());
                    new_pos
                }
            }
        } else {
            // New position
            let pos = match position_side {
                PositionSide::Long => Position::new_long(
                    user_id,
                    symbol,
                    size,
                    price,
                    leverage,
                    maintenance_margin_rate,
                ),
                PositionSide::Short => Position::new_short(
                    user_id,
                    symbol,
                    size,
                    price,
                    leverage,
                    maintenance_margin_rate,
                ),
            };
            positions.insert(key, pos.clone());
            pos
        }
    }

    /// Close a position entirely
    /// Returns (closed_position, released_margin) — caller must credit released_margin to user's balance
    pub fn close_position(
        &self,
        user_id: &UserId,
        symbol: &Symbol,
        close_price: Decimal,
        maintenance_margin_rate: Decimal,
    ) -> Option<(Position, Decimal)> {
        let mut positions = self.positions.write();
        let key = (*user_id, *symbol);
        if let Some(pos) = positions.get_mut(&key) {
            let size = pos.size;
            let (_pnl, released_margin) = pos.decrease(size, close_price, maintenance_margin_rate);
            let closed = pos.clone();
            positions.remove(&key);
            Some((closed, released_margin))
        } else {
            None
        }
    }

    /// Remove a position (after liquidation)
    pub fn remove_position(&self, user_id: &UserId, symbol: &Symbol) -> Option<Position> {
        self.positions.write().remove(&(*user_id, *symbol))
    }

    /// Count total positions
    pub fn position_count(&self) -> usize {
        self.positions.read().len()
    }
}

// ============================================================================
// MARK PRICE
// ============================================================================

/// Mark price calculation methods
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MarkPriceMethod {
    /// Simple mid-price: (best_bid + best_ask) / 2
    MidPrice,
    /// Weighted mid-price considering depth
    WeightedMidPrice,
    /// External index price with premium
    IndexPlusPremium,
}

/// Mark price tracker with history
pub struct MarkPriceTracker {
    /// Current mark price per symbol
    current: parking_lot::RwLock<HashMap<Symbol, MarkPriceData>>,
    /// Historical mark prices (for TWAP calculations)
    history: parking_lot::RwLock<HashMap<Symbol, Vec<(Timestamp, Decimal)>>>,
    /// Maximum history entries to keep per symbol
    max_history: usize,
}

/// Current mark price data for a symbol
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarkPriceData {
    pub symbol: Symbol,
    pub mark_price: Decimal,
    pub index_price: Decimal,
    pub best_bid: Decimal,
    pub best_ask: Decimal,
    pub method: MarkPriceMethod,
    pub timestamp: Timestamp,
}

impl Default for MarkPriceTracker {
    fn default() -> Self {
        Self::new()
    }
}

impl MarkPriceTracker {
    pub fn new() -> Self {
        Self {
            current: parking_lot::RwLock::new(HashMap::new()),
            history: parking_lot::RwLock::new(HashMap::new()),
            max_history: 10000,
        }
    }

    /// Calculate mark price from orderbook BBO
    pub fn update_from_bbo(
        &self,
        symbol: Symbol,
        best_bid: Decimal,
        best_ask: Decimal,
        index_price: Option<Decimal>,
    ) -> Decimal {
        let mid_price = (best_bid + best_ask) / 2;
        let mark_price = if let Some(idx) = index_price {
            // Use EMA between mid and index for stability
            // mark = 0.5 * mid + 0.5 * index
            (mid_price + idx) / 2
        } else {
            mid_price
        };

        let data = MarkPriceData {
            symbol,
            mark_price,
            index_price: index_price.unwrap_or(mid_price),
            best_bid,
            best_ask,
            method: if index_price.is_some() {
                MarkPriceMethod::IndexPlusPremium
            } else {
                MarkPriceMethod::MidPrice
            },
            timestamp: now_nanos(),
        };

        // Store current
        self.current.write().insert(symbol, data);

        // Store in history
        let mut history = self.history.write();
        let entries = history.entry(symbol).or_insert_with(Vec::new);
        entries.push((now_nanos(), mark_price));
        if entries.len() > self.max_history {
            entries.drain(0..entries.len() - self.max_history);
        }

        mark_price
    }

    /// Get current mark price for a symbol
    pub fn get_mark_price(&self, symbol: &Symbol) -> Option<Decimal> {
        self.current.read().get(symbol).map(|d| d.mark_price)
    }

    /// Get full mark price data
    pub fn get_mark_price_data(&self, symbol: &Symbol) -> Option<MarkPriceData> {
        self.current.read().get(symbol).cloned()
    }

    /// Get TWAP (time-weighted average price) over last N entries
    pub fn get_twap(&self, symbol: &Symbol, entries: usize) -> Option<Decimal> {
        let history = self.history.read();
        let prices = history.get(symbol)?;
        if prices.is_empty() {
            return None;
        }
        let start = if prices.len() > entries {
            prices.len() - entries
        } else {
            0
        };
        let sum: i64 = prices[start..].iter().map(|(_, p)| *p).sum();
        let count = prices[start..].len() as i64;
        Some(sum / count)
    }

    /// Get mark price history for a symbol
    pub fn get_history(&self, symbol: &Symbol) -> Vec<(Timestamp, Decimal)> {
        self.history.read().get(symbol).cloned().unwrap_or_default()
    }
}

// ============================================================================
// FUNDING RATES
// ============================================================================

/// Funding rate data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FundingRate {
    pub symbol: Symbol,
    /// Funding rate (positive = longs pay shorts, negative = shorts pay longs)
    pub rate: Decimal,
    /// Mark price at time of calculation
    pub mark_price: Decimal,
    /// Index/spot price
    pub index_price: Decimal,
    /// Settlement timestamp
    pub timestamp: Timestamp,
    /// Next settlement timestamp
    pub next_settlement: Timestamp,
}

/// Funding rate calculator
pub struct FundingRateCalculator {
    /// Funding interval in nanoseconds (default: 8 hours)
    pub interval_nanos: u64,
    /// Maximum funding rate (default: 0.75% = 0.0075)
    pub max_rate: Decimal,
    /// Minimum funding rate (default: -0.75%)
    pub min_rate: Decimal,
    /// Current rates per symbol
    current_rates: parking_lot::RwLock<HashMap<Symbol, FundingRate>>,
    /// Settlement history
    history: parking_lot::RwLock<HashMap<Symbol, Vec<FundingRate>>>,
}

/// 8 hours in nanoseconds
const EIGHT_HOURS_NANOS: u64 = 8 * 60 * 60 * 1_000_000_000;

impl Default for FundingRateCalculator {
    fn default() -> Self {
        Self::new()
    }
}

impl FundingRateCalculator {
    pub fn new() -> Self {
        Self {
            interval_nanos: EIGHT_HOURS_NANOS,
            max_rate: to_decimal(0.0075),  // 0.75%
            min_rate: to_decimal(-0.0075), // -0.75%
            current_rates: parking_lot::RwLock::new(HashMap::new()),
            history: parking_lot::RwLock::new(HashMap::new()),
        }
    }

    /// Calculate funding rate: (mark_price - index_price) / index_price
    /// Clamped to [min_rate, max_rate]
    pub fn calculate_rate(
        &self,
        symbol: Symbol,
        mark_price: Decimal,
        index_price: Decimal,
    ) -> FundingRate {
        let premium = mark_price - index_price;
        let mut rate = if index_price != 0 {
            div_decimal(premium, index_price)
        } else {
            0
        };

        // Clamp rate
        rate = rate.max(self.min_rate).min(self.max_rate);

        let now = now_nanos();
        let funding = FundingRate {
            symbol,
            rate,
            mark_price,
            index_price,
            timestamp: now,
            next_settlement: now + self.interval_nanos,
        };

        self.current_rates.write().insert(symbol, funding.clone());
        funding
    }

    /// Get current funding rate for a symbol
    pub fn get_rate(&self, symbol: &Symbol) -> Option<FundingRate> {
        self.current_rates.read().get(symbol).cloned()
    }

    /// Calculate funding payment for a position
    /// payment = position_size * mark_price * funding_rate
    /// Positive payment means position holder pays, negative means receives
    pub fn calculate_payment(&self, position: &Position) -> Option<Decimal> {
        let rate = self.current_rates.read().get(&position.symbol)?.rate;
        let notional = mul_decimal(position.entry_price, position.size);
        let payment = mul_decimal(notional, rate);

        // Longs pay when rate > 0, shorts pay when rate < 0
        match position.side {
            PositionSide::Long => Some(payment), // Positive rate = long pays
            PositionSide::Short => Some(-payment), // Positive rate = short receives
        }
    }

    /// Settle funding for all positions
    /// Returns list of (user_id, symbol, payment_amount)
    pub fn settle_funding(&self, positions: &[Position]) -> Vec<FundingPayment> {
        let rates = self.current_rates.read();
        let mut payments = Vec::new();

        for pos in positions {
            if let Some(funding) = rates.get(&pos.symbol) {
                let notional = mul_decimal(pos.entry_price, pos.size);
                let payment = mul_decimal(notional, funding.rate);
                let amount = match pos.side {
                    PositionSide::Long => payment,
                    PositionSide::Short => -payment,
                };

                payments.push(FundingPayment {
                    user_id: pos.user_id,
                    symbol: pos.symbol,
                    position_size: pos.size,
                    funding_rate: funding.rate,
                    payment: amount,
                    timestamp: now_nanos(),
                });
            }
        }

        // Store settlement in history
        let mut history = self.history.write();
        for payment in &payments {
            let entries = history.entry(payment.symbol).or_insert_with(Vec::new);
            if let Some(rate) = rates.get(&payment.symbol) {
                entries.push(rate.clone());
            }
        }

        payments
    }

    /// Get funding rate history for a symbol
    pub fn get_history(&self, symbol: &Symbol) -> Vec<FundingRate> {
        self.history.read().get(symbol).cloned().unwrap_or_default()
    }
}

/// A funding payment record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FundingPayment {
    pub user_id: UserId,
    pub symbol: Symbol,
    pub position_size: Decimal,
    pub funding_rate: Decimal,
    /// Positive = user pays, Negative = user receives
    pub payment: Decimal,
    pub timestamp: Timestamp,
}

// ============================================================================
// LIQUIDATION
// ============================================================================

/// Liquidation event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiquidationEvent {
    pub position_id: PositionId,
    pub user_id: UserId,
    pub symbol: Symbol,
    pub side: PositionSide,
    pub size: Decimal,
    pub entry_price: Decimal,
    pub liquidation_price: Decimal,
    pub mark_price: Decimal,
    /// Loss absorbed by insurance fund
    pub insurance_loss: Decimal,
    pub timestamp: Timestamp,
}

/// Liquidation engine scans positions and triggers liquidations
pub struct LiquidationEngine {
    /// Maintenance margin rate (default: 0.5% = 0.005)
    pub maintenance_margin_rate: Decimal,
    /// Insurance fund balance
    pub insurance_fund: parking_lot::RwLock<Decimal>,
    /// Liquidation history
    history: parking_lot::RwLock<Vec<LiquidationEvent>>,
}

impl Default for LiquidationEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl LiquidationEngine {
    pub fn new() -> Self {
        Self {
            maintenance_margin_rate: to_decimal(0.005), // 0.5%
            insurance_fund: parking_lot::RwLock::new(to_decimal(1_000_000.0)), // 1M initial
            history: parking_lot::RwLock::new(Vec::new()),
        }
    }

    /// Create with custom maintenance margin rate
    pub fn with_maintenance_rate(rate: f64) -> Self {
        Self {
            maintenance_margin_rate: to_decimal(rate),
            insurance_fund: parking_lot::RwLock::new(to_decimal(1_000_000.0)),
            history: parking_lot::RwLock::new(Vec::new()),
        }
    }

    /// Get maintenance margin rate
    pub fn maintenance_margin_rate(&self) -> Decimal {
        self.maintenance_margin_rate
    }

    /// Get insurance fund balance
    pub fn insurance_fund_balance(&self) -> Decimal {
        *self.insurance_fund.read()
    }

    /// Scan positions and return those needing liquidation
    pub fn scan_liquidations(
        &self,
        positions: &[Position],
        mark_prices: &HashMap<Symbol, Decimal>,
    ) -> Vec<LiquidationEvent> {
        let mut liquidations = Vec::new();

        for pos in positions {
            if let Some(&mark_price) = mark_prices.get(&pos.symbol) {
                if pos.should_liquidate(mark_price) {
                    let unrealized = pos.unrealized_pnl(mark_price);
                    let insurance_loss = if unrealized < -pos.margin {
                        // Loss exceeds margin - insurance covers the difference
                        -(unrealized + pos.margin)
                    } else {
                        0
                    };

                    let event = LiquidationEvent {
                        position_id: pos.id,
                        user_id: pos.user_id,
                        symbol: pos.symbol,
                        side: pos.side,
                        size: pos.size,
                        entry_price: pos.entry_price,
                        liquidation_price: pos.liquidation_price,
                        mark_price,
                        insurance_loss,
                        timestamp: now_nanos(),
                    };

                    liquidations.push(event);
                }
            }
        }

        liquidations
    }

    /// Execute liquidation: deduct from insurance fund and record
    pub fn execute_liquidation(&self, event: LiquidationEvent) {
        if event.insurance_loss > 0 {
            let mut fund = self.insurance_fund.write();
            *fund -= event.insurance_loss;
        }
        self.history.write().push(event);
    }

    /// Get liquidation history
    pub fn get_history(&self) -> Vec<LiquidationEvent> {
        self.history.read().clone()
    }

    /// Add to insurance fund (from liquidation profits, fees, etc.)
    pub fn add_to_insurance_fund(&self, amount: Decimal) {
        *self.insurance_fund.write() += amount;
    }
}

// ============================================================================
// STOP-LOSS / TAKE-PROFIT (Conditional Orders)
// ============================================================================

/// A conditional order (stop-loss or take-profit)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConditionalOrder {
    pub id: OrderId,
    pub user_id: UserId,
    pub symbol: Symbol,
    pub side: Side,
    /// The trigger price
    pub trigger_price: Decimal,
    /// Trigger condition
    pub trigger_condition: TriggerCondition,
    /// The order to place when triggered
    pub order_type: OrderType,
    /// Price for limit order (0 for market)
    pub order_price: Decimal,
    /// Quantity
    pub quantity: Decimal,
    /// Whether this has been triggered
    pub triggered: bool,
    pub created_at: Timestamp,
}

/// When the conditional order triggers
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TriggerCondition {
    /// Trigger when mark price >= trigger_price (take-profit for longs, stop-loss for shorts)
    PriceAbove,
    /// Trigger when mark price <= trigger_price (stop-loss for longs, take-profit for shorts)
    PriceBelow,
}

/// Conditional order manager
pub struct ConditionalOrderManager {
    orders: parking_lot::RwLock<Vec<ConditionalOrder>>,
}

impl Default for ConditionalOrderManager {
    fn default() -> Self {
        Self::new()
    }
}

impl ConditionalOrderManager {
    pub fn new() -> Self {
        Self {
            orders: parking_lot::RwLock::new(Vec::new()),
        }
    }

    /// Add a conditional order
    pub fn add_order(&self, order: ConditionalOrder) {
        self.orders.write().push(order);
    }

    /// Check for triggered orders given current mark prices
    /// Returns triggered orders (removed from pending list)
    pub fn check_triggers(&self, mark_prices: &HashMap<Symbol, Decimal>) -> Vec<ConditionalOrder> {
        let mut orders = self.orders.write();
        let mut triggered = Vec::new();
        let mut remaining = Vec::new();

        for mut order in orders.drain(..) {
            if let Some(&price) = mark_prices.get(&order.symbol) {
                let should_trigger = match order.trigger_condition {
                    TriggerCondition::PriceAbove => price >= order.trigger_price,
                    TriggerCondition::PriceBelow => price <= order.trigger_price,
                };
                if should_trigger {
                    order.triggered = true;
                    triggered.push(order);
                } else {
                    remaining.push(order);
                }
            } else {
                remaining.push(order);
            }
        }

        *orders = remaining;
        triggered
    }

    /// Cancel a conditional order by ID
    pub fn cancel_order(&self, order_id: &OrderId) -> Option<ConditionalOrder> {
        let mut orders = self.orders.write();
        if let Some(pos) = orders.iter().position(|o| o.id == *order_id) {
            Some(orders.remove(pos))
        } else {
            None
        }
    }

    /// Get pending conditional orders for a user
    pub fn get_user_orders(&self, user_id: &UserId) -> Vec<ConditionalOrder> {
        self.orders
            .read()
            .iter()
            .filter(|o| o.user_id == *user_id)
            .cloned()
            .collect()
    }

    /// Count pending orders
    pub fn pending_count(&self) -> usize {
        self.orders.read().len()
    }
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/// A batch of orders to process atomically
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchOrder {
    pub orders: Vec<BatchOrderItem>,
    pub atomic: bool, // If true, all-or-nothing
}

/// Individual item in a batch
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchOrderItem {
    pub user_id: UserId,
    pub symbol: Symbol,
    pub side: Side,
    pub order_type: OrderType,
    pub price: Decimal,
    pub quantity: Decimal,
    pub time_in_force: TimeInForce,
}

/// Result of batch processing
#[derive(Debug, Clone)]
pub struct BatchResult {
    pub results: Vec<BatchItemResult>,
    pub all_succeeded: bool,
}

/// Result of a single batch item
#[derive(Debug, Clone)]
pub struct BatchItemResult {
    pub index: usize,
    pub success: bool,
    pub order_id: Option<OrderId>,
    pub error: Option<String>,
}

// ============================================================================
// ORDER MODIFICATION
// ============================================================================

/// Order amendment request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderAmendment {
    pub order_id: OrderId,
    pub user_id: UserId,
    pub symbol: Symbol,
    pub new_price: Option<Decimal>,
    pub new_quantity: Option<Decimal>,
}

// ============================================================================
// PORTFOLIO
// ============================================================================

/// Portfolio summary for a user
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortfolioSummary {
    pub user_id: UserId,
    /// Total collateral/balance
    pub total_collateral: Decimal,
    /// Margin used by open positions
    pub used_margin: Decimal,
    /// Available margin for new positions
    pub available_margin: Decimal,
    /// Margin ratio (used/total)
    pub margin_ratio: f64,
    /// Total unrealized P&L
    pub total_unrealized_pnl: Decimal,
    /// Total realized P&L
    pub total_realized_pnl: Decimal,
    /// Number of open positions
    pub open_positions: u32,
    pub timestamp: Timestamp,
}

/// Position summary for reporting
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PositionSummary {
    pub position_id: PositionId,
    pub symbol: Symbol,
    pub side: PositionSide,
    pub size: Decimal,
    pub entry_price: Decimal,
    pub mark_price: Decimal,
    pub liquidation_price: Decimal,
    pub leverage: Leverage,
    pub margin: Decimal,
    pub unrealized_pnl: Decimal,
    pub realized_pnl: Decimal,
    pub margin_ratio: f64,
}

impl PositionSummary {
    pub fn from_position(pos: &Position, mark_price: Decimal) -> Self {
        Self {
            position_id: pos.id,
            symbol: pos.symbol,
            side: pos.side,
            size: pos.size,
            entry_price: pos.entry_price,
            mark_price,
            liquidation_price: pos.liquidation_price,
            leverage: pos.leverage,
            margin: pos.margin,
            unrealized_pnl: pos.unrealized_pnl(mark_price),
            realized_pnl: pos.realized_pnl,
            margin_ratio: pos.margin_ratio(mark_price),
        }
    }
}

// ============================================================================
// HEALTH & MONITORING
// ============================================================================

/// Engine health status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthStatus {
    pub status: EngineStatus,
    pub uptime_secs: u64,
    pub version: String,
    pub symbols: Vec<String>,
    pub total_orders: u64,
    pub total_trades: u64,
    pub latency_p50_ns: u64,
    pub latency_p95_ns: u64,
    pub latency_p99_ns: u64,
    pub orders_per_sec: f64,
    pub timestamp: Timestamp,
}

/// Engine status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EngineStatus {
    Healthy,
    Degraded,
    Unhealthy,
}

// ============================================================================
// CIRCUIT BREAKER
// ============================================================================

/// Market state for circuit breaker
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MarketState {
    /// Normal trading
    Open,
    /// Trading halted by circuit breaker
    Halted,
    /// Pre-open auction (after halt)
    PreOpen,
    /// Closed for maintenance
    Closed,
}

/// Circuit breaker configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CircuitBreakerConfig {
    /// Maximum price move in percentage over the window (e.g., 0.10 = 10%)
    pub max_price_move: f64,
    /// Time window in nanoseconds for price move detection
    pub window_nanos: u64,
    /// Cooldown period before re-opening (nanoseconds)
    pub cooldown_nanos: u64,
    /// Maximum volume spike multiplier (e.g., 10.0 = 10x normal)
    pub max_volume_spike: f64,
}

impl Default for CircuitBreakerConfig {
    fn default() -> Self {
        Self {
            max_price_move: 0.10,            // 10% in 1 minute
            window_nanos: 60_000_000_000,    // 1 minute
            cooldown_nanos: 300_000_000_000, // 5 minutes
            max_volume_spike: 10.0,
        }
    }
}

/// Circuit breaker state per market
pub struct CircuitBreaker {
    config: CircuitBreakerConfig,
    states: parking_lot::RwLock<HashMap<Symbol, MarketState>>,
    reference_prices: parking_lot::RwLock<HashMap<Symbol, (Decimal, Timestamp)>>,
}

impl Default for CircuitBreaker {
    fn default() -> Self {
        Self::new(CircuitBreakerConfig::default())
    }
}

impl CircuitBreaker {
    pub fn new(config: CircuitBreakerConfig) -> Self {
        Self {
            config,
            states: parking_lot::RwLock::new(HashMap::new()),
            reference_prices: parking_lot::RwLock::new(HashMap::new()),
        }
    }

    /// Get current market state
    pub fn market_state(&self, symbol: &Symbol) -> MarketState {
        self.states
            .read()
            .get(symbol)
            .copied()
            .unwrap_or(MarketState::Open)
    }

    /// Check if a price triggers the circuit breaker
    pub fn check_price(&self, symbol: Symbol, current_price: Decimal) -> MarketState {
        let mut refs = self.reference_prices.write();
        let now = now_nanos();

        if let Some((ref_price, ref_time)) = refs.get(&symbol) {
            // Check if window has passed - reset reference
            if now - ref_time > self.config.window_nanos {
                refs.insert(symbol, (current_price, now));
                return self.market_state(&symbol);
            }

            // Calculate price deviation
            let deviation =
                from_decimal(div_decimal((current_price - *ref_price).abs(), *ref_price));

            if deviation > self.config.max_price_move {
                // Trigger circuit breaker
                self.states.write().insert(symbol, MarketState::Halted);
                return MarketState::Halted;
            }
        } else {
            // First price - set as reference
            refs.insert(symbol, (current_price, now));
        }

        self.market_state(&symbol)
    }

    /// Manually set market state
    pub fn set_market_state(&self, symbol: Symbol, state: MarketState) {
        self.states.write().insert(symbol, state);
        if state == MarketState::Open {
            // Reset reference price on open
            self.reference_prices.write().remove(&symbol);
        }
    }

    /// Check if market is open for trading
    pub fn is_trading_allowed(&self, symbol: &Symbol) -> bool {
        self.market_state(symbol) == MarketState::Open
    }
}

// ============================================================================
// PERSISTENCE TYPES
// ============================================================================

/// Orderbook snapshot for persistence
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistenceSnapshot {
    pub symbol: Symbol,
    pub snapshot: OrderbookSnapshot,
    pub positions: Vec<Position>,
    pub sequence: u64,
    pub timestamp: Timestamp,
}

/// Event log entry for replay
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventLogEntry {
    pub sequence: u64,
    pub timestamp: Timestamp,
    pub event_type: String,
    pub payload: String,
}

/// Message replay state
pub struct EventLog {
    entries: parking_lot::RwLock<Vec<EventLogEntry>>,
    max_entries: usize,
}

impl Default for EventLog {
    fn default() -> Self {
        Self::new(1_000_000)
    }
}

impl EventLog {
    pub fn new(max_entries: usize) -> Self {
        Self {
            entries: parking_lot::RwLock::new(Vec::new()),
            max_entries,
        }
    }

    /// Append an event to the log
    pub fn append(&self, sequence: u64, event_type: &str, payload: &str) {
        let entry = EventLogEntry {
            sequence,
            timestamp: now_nanos(),
            event_type: event_type.to_string(),
            payload: payload.to_string(),
        };
        let mut entries = self.entries.write();
        entries.push(entry);
        let len = entries.len();
        if len > self.max_entries {
            entries.drain(0..len - self.max_entries);
        }
    }

    /// Get events from a specific sequence number
    pub fn get_from_sequence(&self, from_seq: u64) -> Vec<EventLogEntry> {
        self.entries
            .read()
            .iter()
            .filter(|e| e.sequence >= from_seq)
            .cloned()
            .collect()
    }

    /// Get all entries
    pub fn all_entries(&self) -> Vec<EventLogEntry> {
        self.entries.read().clone()
    }

    /// Get entry count
    pub fn len(&self) -> usize {
        self.entries.read().len()
    }

    /// Check if empty
    pub fn is_empty(&self) -> bool {
        self.entries.read().is_empty()
    }
}

// ============================================================================
// FAIR PRICE INDICATION
// ============================================================================

/// Fair price indication with slippage estimate
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FairPriceIndication {
    pub symbol: Symbol,
    pub side: Side,
    pub quantity: Decimal,
    /// Average execution price
    pub avg_price: Decimal,
    /// Slippage from best price
    pub slippage_bps: f64,
    /// Whether the full quantity can be filled
    pub can_fill: bool,
    /// Available liquidity at this price
    pub available_liquidity: Decimal,
    pub timestamp: Timestamp,
}

// ============================================================================
// TRADE HISTORY
// ============================================================================

/// Trade history storage
pub struct TradeHistory {
    trades: parking_lot::RwLock<Vec<Trade>>,
    max_trades: usize,
}

impl Default for TradeHistory {
    fn default() -> Self {
        Self::new(1_000_000)
    }
}

impl TradeHistory {
    pub fn new(max_trades: usize) -> Self {
        Self {
            trades: parking_lot::RwLock::new(Vec::new()),
            max_trades,
        }
    }

    /// Record a trade
    pub fn record(&self, trade: Trade) {
        let mut trades = self.trades.write();
        trades.push(trade);
        let len = trades.len();
        if len > self.max_trades {
            trades.drain(0..len - self.max_trades);
        }
    }

    /// Get trades for a symbol
    pub fn get_by_symbol(&self, symbol: &Symbol) -> Vec<Trade> {
        self.trades
            .read()
            .iter()
            .filter(|t| t.symbol == *symbol)
            .cloned()
            .collect()
    }

    /// Get trades for a user
    pub fn get_by_user(&self, user_id: &UserId) -> Vec<Trade> {
        self.trades
            .read()
            .iter()
            .filter(|t| t.maker_user_id == *user_id || t.taker_user_id == *user_id)
            .cloned()
            .collect()
    }

    /// Get all trades
    pub fn all_trades(&self) -> Vec<Trade> {
        self.trades.read().clone()
    }

    /// Get trade count
    pub fn len(&self) -> usize {
        self.trades.read().len()
    }

    /// Check if empty
    pub fn is_empty(&self) -> bool {
        self.trades.read().is_empty()
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_leverage_validation() {
        assert!(validate_leverage(to_leverage(1.0)));
        assert!(validate_leverage(to_leverage(10.0)));
        assert!(validate_leverage(to_leverage(50.0)));
        assert!(!validate_leverage(to_leverage(0.5)));
        assert!(!validate_leverage(to_leverage(51.0)));
    }

    #[test]
    fn test_margin_calculation() {
        let price = to_decimal(50000.0);
        let qty = to_decimal(1.0);
        let leverage = to_leverage(10.0);
        let margin = calculate_margin(price, qty, leverage);
        // 50000 * 1 / 10 = 5000
        assert_eq!(from_decimal(margin), 5000.0);
    }

    #[test]
    fn test_position_long_pnl() {
        let maintenance = to_decimal(0.005);
        let pos = Position::new_long(
            UserId::from_u64(1),
            Symbol::new("BTC-USDT"),
            to_decimal(1.0),
            to_decimal(50000.0),
            to_leverage(10.0),
            maintenance,
        );

        // Price goes up by 1000 -> profit = 1000
        let pnl = pos.unrealized_pnl(to_decimal(51000.0));
        assert_eq!(from_decimal(pnl), 1000.0);

        // Price goes down by 1000 -> loss = -1000
        let pnl = pos.unrealized_pnl(to_decimal(49000.0));
        assert_eq!(from_decimal(pnl), -1000.0);
    }

    #[test]
    fn test_position_short_pnl() {
        let maintenance = to_decimal(0.005);
        let pos = Position::new_short(
            UserId::from_u64(1),
            Symbol::new("BTC-USDT"),
            to_decimal(1.0),
            to_decimal(50000.0),
            to_leverage(10.0),
            maintenance,
        );

        // Price goes down -> profit for short
        let pnl = pos.unrealized_pnl(to_decimal(49000.0));
        assert_eq!(from_decimal(pnl), 1000.0);

        // Price goes up -> loss for short
        let pnl = pos.unrealized_pnl(to_decimal(51000.0));
        assert_eq!(from_decimal(pnl), -1000.0);
    }

    #[test]
    fn test_position_liquidation_check() {
        let maintenance = to_decimal(0.005);
        let pos = Position::new_long(
            UserId::from_u64(1),
            Symbol::new("BTC-USDT"),
            to_decimal(1.0),
            to_decimal(50000.0),
            to_leverage(10.0),
            maintenance,
        );

        // Should NOT be liquidated at current price
        assert!(!pos.should_liquidate(to_decimal(50000.0)));
        assert!(!pos.should_liquidate(to_decimal(48000.0)));

        // Should be liquidated below liquidation price
        assert!(pos.should_liquidate(pos.liquidation_price));
        assert!(pos.should_liquidate(pos.liquidation_price - to_decimal(100.0)));
    }

    #[test]
    fn test_position_increase_and_decrease() {
        let maintenance = to_decimal(0.005);
        let mut pos = Position::new_long(
            UserId::from_u64(1),
            Symbol::new("BTC-USDT"),
            to_decimal(1.0),
            to_decimal(50000.0),
            to_leverage(10.0),
            maintenance,
        );

        // Increase position
        pos.increase(
            to_decimal(1.0),
            to_decimal(52000.0),
            to_leverage(10.0),
            maintenance,
        );
        assert_eq!(from_decimal(pos.size), 2.0);
        // Avg entry = (50000 + 52000) / 2 = 51000
        assert_eq!(from_decimal(pos.entry_price), 51000.0);

        // Partial close at profit
        let (pnl, _released) = pos.decrease(to_decimal(1.0), to_decimal(53000.0), maintenance);
        assert_eq!(from_decimal(pos.size), 1.0);
        // P&L = (53000 - 51000) * 1 = 2000
        assert_eq!(from_decimal(pnl), 2000.0);
    }

    #[test]
    fn test_position_manager() {
        let mgr = PositionManager::new();
        let user = UserId::from_u64(1);
        let symbol = Symbol::new("BTC-USDT");
        let maintenance = to_decimal(0.005);

        // Open position
        let pos = mgr.update_from_trade(
            user,
            symbol,
            Side::Buy,
            to_decimal(1.0),
            to_decimal(50000.0),
            to_leverage(10.0),
            maintenance,
        );
        assert_eq!(from_decimal(pos.size), 1.0);
        assert_eq!(mgr.position_count(), 1);

        // Increase position
        let pos = mgr.update_from_trade(
            user,
            symbol,
            Side::Buy,
            to_decimal(1.0),
            to_decimal(51000.0),
            to_leverage(10.0),
            maintenance,
        );
        assert_eq!(from_decimal(pos.size), 2.0);
        assert_eq!(mgr.position_count(), 1);

        // Close position
        mgr.close_position(&user, &symbol, to_decimal(52000.0), maintenance);
        assert_eq!(mgr.position_count(), 0);
    }

    #[test]
    fn test_mark_price_tracker() {
        let tracker = MarkPriceTracker::new();
        let symbol = Symbol::new("BTC-USDT");

        let mark = tracker.update_from_bbo(symbol, to_decimal(49900.0), to_decimal(50100.0), None);
        // Mid = (49900 + 50100) / 2 = 50000
        assert_eq!(from_decimal(mark), 50000.0);

        let data = tracker.get_mark_price_data(&symbol).unwrap();
        assert_eq!(from_decimal(data.mark_price), 50000.0);
    }

    #[test]
    fn test_funding_rate_calculation() {
        let calculator = FundingRateCalculator::new();
        let symbol = Symbol::new("BTC-USDT");

        // Mark price above index -> positive funding rate
        let funding = calculator.calculate_rate(symbol, to_decimal(50100.0), to_decimal(50000.0));
        assert!(funding.rate > 0);

        // Mark price below index -> negative funding rate
        let funding = calculator.calculate_rate(symbol, to_decimal(49900.0), to_decimal(50000.0));
        assert!(funding.rate < 0);
    }

    #[test]
    fn test_funding_settlement() {
        let calculator = FundingRateCalculator::new();
        let symbol = Symbol::new("BTC-USDT");

        // Set positive funding rate
        calculator.calculate_rate(symbol, to_decimal(50100.0), to_decimal(50000.0));

        // Create positions
        let maintenance = to_decimal(0.005);
        let long_pos = Position::new_long(
            UserId::from_u64(1),
            symbol,
            to_decimal(1.0),
            to_decimal(50000.0),
            to_leverage(10.0),
            maintenance,
        );

        let payments = calculator.settle_funding(&[long_pos]);
        assert_eq!(payments.len(), 1);
        // Long pays when rate is positive
        assert!(payments[0].payment > 0);
    }

    #[test]
    fn test_liquidation_scan() {
        let liq_engine = LiquidationEngine::new();
        let maintenance = liq_engine.maintenance_margin_rate();
        let symbol = Symbol::new("BTC-USDT");

        let pos = Position::new_long(
            UserId::from_u64(1),
            symbol,
            to_decimal(1.0),
            to_decimal(50000.0),
            to_leverage(10.0),
            maintenance,
        );

        let liq_price = pos.liquidation_price;

        // At current price - no liquidation
        let mut mark_prices = HashMap::new();
        mark_prices.insert(symbol, to_decimal(50000.0));
        let liquidations = liq_engine.scan_liquidations(&[pos.clone()], &mark_prices);
        assert!(liquidations.is_empty());

        // Below liquidation price - should liquidate
        mark_prices.insert(symbol, liq_price - to_decimal(100.0));
        let liquidations = liq_engine.scan_liquidations(&[pos], &mark_prices);
        assert_eq!(liquidations.len(), 1);
    }

    #[test]
    fn test_conditional_orders() {
        let mgr = ConditionalOrderManager::new();
        let symbol = Symbol::new("BTC-USDT");

        // Add stop-loss for long position (trigger when price drops)
        let stop_loss = ConditionalOrder {
            id: OrderId::new(),
            user_id: UserId::from_u64(1),
            symbol,
            side: Side::Sell,
            trigger_price: to_decimal(48000.0),
            trigger_condition: TriggerCondition::PriceBelow,
            order_type: OrderType::Market,
            order_price: 0,
            quantity: to_decimal(1.0),
            triggered: false,
            created_at: now_nanos(),
        };

        mgr.add_order(stop_loss);
        assert_eq!(mgr.pending_count(), 1);

        // Price above trigger - should not trigger
        let mut prices = HashMap::new();
        prices.insert(symbol, to_decimal(50000.0));
        let triggered = mgr.check_triggers(&prices);
        assert!(triggered.is_empty());
        assert_eq!(mgr.pending_count(), 1);

        // Price below trigger - should trigger
        prices.insert(symbol, to_decimal(47500.0));
        let triggered = mgr.check_triggers(&prices);
        assert_eq!(triggered.len(), 1);
        assert_eq!(mgr.pending_count(), 0);
    }

    #[test]
    fn test_circuit_breaker() {
        let cb = CircuitBreaker::new(CircuitBreakerConfig {
            max_price_move: 0.10, // 10%
            window_nanos: 60_000_000_000,
            cooldown_nanos: 300_000_000_000,
            max_volume_spike: 10.0,
        });
        let symbol = Symbol::new("BTC-USDT");

        // First price establishes reference
        let state = cb.check_price(symbol, to_decimal(50000.0));
        assert_eq!(state, MarketState::Open);

        // Small move - OK
        let state = cb.check_price(symbol, to_decimal(51000.0));
        assert_eq!(state, MarketState::Open);

        // Large move (>10%) - should halt
        let state = cb.check_price(symbol, to_decimal(56000.0));
        assert_eq!(state, MarketState::Halted);

        // Manual reset
        cb.set_market_state(symbol, MarketState::Open);
        assert!(cb.is_trading_allowed(&symbol));
    }

    #[test]
    fn test_event_log() {
        let log = EventLog::new(1000);

        log.append(1, "order_placed", r#"{"id": 1}"#);
        log.append(2, "trade_executed", r#"{"id": 2}"#);
        log.append(3, "order_cancelled", r#"{"id": 3}"#);

        assert_eq!(log.len(), 3);

        let events = log.get_from_sequence(2);
        assert_eq!(events.len(), 2);
    }

    #[test]
    fn test_trade_history() {
        let history = TradeHistory::new(1000);
        let symbol = Symbol::new("BTC-USDT");

        let trade = Trade::new(
            symbol,
            to_decimal(50000.0),
            to_decimal(1.0),
            OrderId::new(),
            OrderId::new(),
            UserId::from_u64(1),
            UserId::from_u64(2),
            Side::Sell,
            Side::Buy,
            1,
        );

        history.record(trade);
        assert_eq!(history.len(), 1);

        let user_trades = history.get_by_user(&UserId::from_u64(1));
        assert_eq!(user_trades.len(), 1);

        let symbol_trades = history.get_by_symbol(&symbol);
        assert_eq!(symbol_trades.len(), 1);
    }
}
