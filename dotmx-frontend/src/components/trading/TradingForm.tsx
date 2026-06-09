"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAccount } from "@/hooks/useAuth";
import { usePlaceOrder, useBalance } from "@/hooks/useTrading";
import { usePositionsData } from "@/hooks";
import { useTradePair } from "@/contexts/TradePairContext";
import {
  formatBalance,
  formatErrorAmount,
  formatPercentage1,
  formatSizeUSD,
  formatPrice,
  formatFee,
} from "@/utils/formatting";

// ─── Types ──────────────────────────────────────────────────────────────────────

type OrderType = "market" | "limit" | "stop_limit" | "stop_market";
type OrderSide = "long" | "short";
type TIF = "GTC" | "IOC" | "FOK" | "POST_ONLY";

const ORDER_TYPES: { key: OrderType; label: string }[] = [
  { key: "market", label: "Market" },
  { key: "limit", label: "Limit" },
  { key: "stop_limit", label: "Stop Limit" },
  { key: "stop_market", label: "Stop Market" },
];

const TIF_OPTIONS: { key: TIF; label: string; description: string }[] = [
  { key: "GTC", label: "GTC", description: "Good Till Cancel" },
  { key: "IOC", label: "IOC", description: "Immediate or Cancel" },
  { key: "FOK", label: "FOK", description: "Fill or Kill" },
  { key: "POST_ONLY", label: "Post", description: "Post Only (maker)" },
];

const LEVERAGE_PRESETS = [1, 2, 5, 10, 25, 50];
const MAX_LEVERAGE = 50;

// ─── Error Handler ──────────────────────────────────────────────────────────────

interface ErrorInfo {
  type: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "error";
  timestamp: number;
}

function categorizeError(error: unknown): Omit<ErrorInfo, "timestamp"> {
  let errorString = "";
  try {
    if (error instanceof Event) {
      errorString = "Network error";
    } else if (error instanceof Error) {
      errorString = error.message;
    } else if (typeof error === "string") {
      errorString = error;
    } else {
      errorString = JSON.stringify(error);
    }
  } catch {
    errorString = "Unknown error";
  }

  const lower = errorString.toLowerCase();

  if (lower.includes("insufficient") || lower.includes("balance")) {
    return {
      type: "insufficient_funds",
      title: "Insufficient Funds",
      message: errorString,
      severity: "warning",
    };
  }
  if (
    lower.includes("network") ||
    lower.includes("fetch") ||
    lower.includes("timeout")
  ) {
    return {
      type: "network",
      title: "Network Error",
      message: "Connection issue. Please check your network and try again.",
      severity: "error",
    };
  }
  if (
    lower.includes("invalid") ||
    lower.includes("validation") ||
    lower.includes("required")
  ) {
    return {
      type: "validation",
      title: "Validation Error",
      message: errorString,
      severity: "warning",
    };
  }
  if (lower.includes("500") || lower.includes("server")) {
    return {
      type: "server",
      title: "Server Error",
      message: "Server error. Please try again later.",
      severity: "error",
    };
  }

  return {
    type: "unknown",
    title: "Unexpected Error",
    message: errorString || "An unexpected error occurred. Please try again.",
    severity: "error",
  };
}

// ─── Component ──────────────────────────────────────────────────────────────────

function TradingForm() {
  // ── Core form state ─────────────────────────────────────────────────────
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [orderSide, setOrderSide] = useState<OrderSide>("long");
  const [collateralAmount, setCollateralAmount] = useState("10.00");
  const [leverage, setLeverage] = useState(10);
  const [limitPrice, setLimitPrice] = useState("");
  const [stopPrice, setStopPrice] = useState("");
  const [timeInForce, setTimeInForce] = useState<TIF>("GTC");

  // ── Advanced (TP/SL) ───────────────────────────────────────────────────
  const [showTpSl, setShowTpSl] = useState(false);
  const [takeProfitPrice, setTakeProfitPrice] = useState("");
  const [stopLossPrice, setStopLossPrice] = useState("");

  // ── UI state ───────────────────────────────────────────────────────────
  const [mounted, setMounted] = useState(false);
  const [lastError, setLastError] = useState<ErrorInfo | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // ── Hooks ──────────────────────────────────────────────────────────────
  const { isConnected } = useAccount();
  const { positions } = usePositionsData();
  const { currentPair, market } = useTradePair();
  const {
    currentPrice,
    fundingRate,
    markPrice,
    nextFundingTime,
    high24h,
    low24h,
  } = market;
  const asset = currentPair.asset;

  const {
    placeOrder,
    isLoading: isSubmitting,
    error: tradeError,
  } = usePlaceOrder();
  const { balance } = useBalance();

  const protocolBalance = balance?.available ?? 0;
  const unrealizedPnl = balance?.pnl ?? 0;

  useEffect(() => {
    setMounted(true);
  }, []);

  // ── Handle trade errors ────────────────────────────────────────────────
  useEffect(() => {
    if (tradeError) {
      const info = categorizeError(tradeError);
      setLastError({ ...info, timestamp: Date.now() });
    }
  }, [tradeError]);

  // ── Auto-clear errors ──────────────────────────────────────────────────
  useEffect(() => {
    if (lastError) {
      const t = setTimeout(() => setLastError(null), 8000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [lastError]);

  // ── Handle success ─────────────────────────────────────────────────────
  useEffect(() => {
    if (isSuccess) {
      setTakeProfitPrice("");
      setStopLossPrice("");
      setLimitPrice("");
      setStopPrice("");
      setLastError(null);
      window.dispatchEvent(
        new CustomEvent("newTradeSuccess", {
          detail: {
            timestamp: Date.now(),
            side: orderSide,
            asset,
            collateralAmount: parseFloat(collateralAmount),
            leverage,
          },
        })
      );
      const t = setTimeout(() => setIsSuccess(false), 100);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [isSuccess, orderSide, asset, collateralAmount, leverage]);

  // ── Sync TIF defaults when order type changes ─────────────────────────
  useEffect(() => {
    if (orderType === "market") setTimeInForce("IOC");
    else setTimeInForce("GTC");
  }, [orderType]);

  // ── Populate price from current ───────────────────────────────────────
  const fillLimitFromMark = useCallback(() => {
    if (currentPrice > 0) setLimitPrice(currentPrice.toFixed(2));
  }, [currentPrice]);

  const fillStopFromMark = useCallback(() => {
    if (currentPrice > 0) setStopPrice(currentPrice.toFixed(2));
  }, [currentPrice]);

  // ── Free margin ────────────────────────────────────────────────────────
  const freeMargin = useMemo(() => {
    if (!protocolBalance) return 0;
    const equity = protocolBalance + (unrealizedPnl || 0);
    const usedMargin =
      positions?.reduce((total: number, pos) => {
        return total + Number(pos.margin) / 1e6;
      }, 0) || 0;
    return Math.max(0, equity - usedMargin);
  }, [protocolBalance, unrealizedPnl, positions]);

  // ── Calculations ───────────────────────────────────────────────────────
  const sizeInUSD = parseFloat(collateralAmount || "0") * leverage;

  const entryPrice =
    orderType === "limit" || orderType === "stop_limit"
      ? parseFloat(limitPrice) || currentPrice
      : currentPrice;

  const liquidationThreshold = 0.9 / leverage;
  const liquidationPrice =
    orderSide === "long"
      ? entryPrice * (1 - liquidationThreshold)
      : entryPrice * (1 + liquidationThreshold);

  const tradingFee = sizeInUSD * 0.0003;

  // ── TP/SL PnL % calculations ──────────────────────────────────────────
  const tpPnlPercent = useMemo(() => {
    if (!takeProfitPrice || !entryPrice) return 0;
    const tp = parseFloat(takeProfitPrice);
    const diff = orderSide === "long" ? tp - entryPrice : entryPrice - tp;
    return (diff / entryPrice) * 100 * leverage;
  }, [takeProfitPrice, entryPrice, orderSide, leverage]);

  const slPnlPercent = useMemo(() => {
    if (!stopLossPrice || !entryPrice) return 0;
    const sl = parseFloat(stopLossPrice);
    const diff = orderSide === "long" ? sl - entryPrice : entryPrice - sl;
    return (diff / entryPrice) * 100 * leverage;
  }, [stopLossPrice, entryPrice, orderSide, leverage]);

  // ── Derived conditions ─────────────────────────────────────────────────
  const showPriceInput = orderType === "limit" || orderType === "stop_limit";
  const showStopInput =
    orderType === "stop_limit" || orderType === "stop_market";
  const showTifSelector = orderType !== "market";

  // ── API order type mapping ─────────────────────────────────────────────
  const getApiOrderType = () => {
    switch (orderType) {
      case "market":
        return "MARKET" as const;
      case "limit":
        return "LIMIT" as const;
      case "stop_limit":
        return "STOP_LIMIT" as const;
      case "stop_market":
        return "STOP_MARKET" as const;
    }
  };

  // ── Submit handler ─────────────────────────────────────────────────────
  const handleTrade = async () => {
    setLastError(null);

    if (!isConnected) {
      setLastError({
        type: "validation",
        title: "Not Connected",
        message: "Please login to place orders.",
        severity: "warning",
        timestamp: Date.now(),
      });
      return;
    }

    const margin = parseFloat(collateralAmount);
    if (isNaN(margin) || margin <= 0) {
      setLastError({
        type: "validation",
        title: "Invalid Margin",
        message: "Please enter a valid margin amount.",
        severity: "warning",
        timestamp: Date.now(),
      });
      return;
    }

    if (margin > freeMargin) {
      setLastError({
        type: "insufficient_funds",
        title: "Insufficient Free Margin",
        message: `Need ${formatErrorAmount(margin)} ${currentPair.collateral} but only ${formatErrorAmount(freeMargin)} available.`,
        severity: "warning",
        timestamp: Date.now(),
      });
      return;
    }

    if (!currentPrice || currentPrice <= 0 || !isFinite(currentPrice)) {
      setLastError({
        type: "validation",
        title: "Price Unavailable",
        message: "Market price is unavailable. Please try again.",
        severity: "error",
        timestamp: Date.now(),
      });
      return;
    }

    if (showPriceInput && (!limitPrice || parseFloat(limitPrice) <= 0)) {
      setLastError({
        type: "validation",
        title: "Price Required",
        message: `Please enter a valid ${orderType === "stop_limit" ? "limit " : ""}price.`,
        severity: "warning",
        timestamp: Date.now(),
      });
      return;
    }

    if (showStopInput && (!stopPrice || parseFloat(stopPrice) <= 0)) {
      setLastError({
        type: "validation",
        title: "Trigger Price Required",
        message: "Please enter a valid trigger/stop price.",
        severity: "warning",
        timestamp: Date.now(),
      });
      return;
    }

    try {
      const effectivePrice = showPriceInput
        ? parseFloat(limitPrice)
        : currentPrice;
      const quantity = sizeInUSD / effectivePrice;

      if (!isFinite(quantity) || quantity <= 0) {
        setLastError({
          type: "validation",
          title: "Invalid Order Size",
          message: "Please enter a valid order size.",
          severity: "error",
          timestamp: Date.now(),
        });
        return;
      }

      await placeOrder({
        symbol: currentPair.symbol,
        side: orderSide === "long" ? "BUY" : "SELL",
        type: getApiOrderType(),
        price: showPriceInput ? parseFloat(limitPrice) : undefined,
        quantity,
        timeInForce: timeInForce !== "POST_ONLY" ? timeInForce : "GTC",
        stopPrice: showStopInput ? parseFloat(stopPrice) : undefined,
        takeProfit: takeProfitPrice ? parseFloat(takeProfitPrice) : undefined,
        stopLoss: stopLossPrice ? parseFloat(stopLossPrice) : undefined,
      });

      setIsSuccess(true);
      setLastError(null);
    } catch (error) {
      const info = categorizeError(error);
      setLastError({ ...info, timestamp: Date.now() });
    }
  };

  // ── Button text ────────────────────────────────────────────────────────
  const buttonText = (() => {
    if (!mounted) return "Loading...";
    if (!isConnected) return "Login to Trade";
    if (isSubmitting) return "Processing...";
    const typeLabel =
      orderType !== "market"
        ? `${ORDER_TYPES.find((t) => t.key === orderType)?.label} `
        : "";
    return `${typeLabel}${orderSide === "long" ? "Long" : "Short"} ${asset}`;
  })();

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="bg-background-card relative flex h-full flex-col">
      {/* ── Error Toast ──────────────────────────────────────────────── */}
      {lastError && (
        <div
          className={`absolute top-2 right-2 left-2 z-50 rounded-lg border p-3 backdrop-blur-sm transition-all duration-300 ${
            lastError.severity === "warning"
              ? "border-yellow-500/50 bg-yellow-500/10"
              : lastError.severity === "info"
                ? "border-blue-500/50 bg-blue-500/10"
                : "border-red-500/50 bg-red-500/10"
          }`}
        >
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-semibold ${
                    lastError.severity === "warning"
                      ? "text-yellow-300"
                      : lastError.severity === "info"
                        ? "text-blue-300"
                        : "text-red-300"
                  }`}
                >
                  {lastError.title}
                </span>
                <button
                  onClick={() => setLastError(null)}
                  className="text-xs text-gray-400 hover:text-gray-300"
                >
                  ✕
                </button>
              </div>
              <p className="mt-0.5 text-xs text-gray-300">
                {lastError.message}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 p-3">
        {/* ── Order Type Tabs ────────────────────────────────────────── */}
        <div className="flex gap-1 rounded-lg bg-white/5 p-1">
          {ORDER_TYPES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setOrderType(key)}
              className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-all ${
                orderType === key
                  ? "border border-white/30 bg-white/15 text-white"
                  : "text-foreground-muted hover:text-foreground border border-transparent hover:bg-white/5"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Side Toggle ────────────────────────────────────────────── */}
        <div className="flex gap-1">
          <button
            onClick={() => setOrderSide("long")}
            className={`flex-1 rounded-md border py-2 text-sm font-semibold transition-all ${
              orderSide === "long"
                ? "border-green-500/70 bg-green-500 text-white"
                : "border-green-500/40 bg-green-500/5 text-green-400/60 hover:border-green-500/60 hover:bg-green-500/10 hover:text-green-400"
            }`}
          >
            Long
          </button>
          <button
            onClick={() => setOrderSide("short")}
            className={`flex-1 rounded-md border py-2 text-sm font-semibold transition-all ${
              orderSide === "short"
                ? "border-red-500/70 bg-red-500 text-white"
                : "border-red-500/40 bg-red-500/5 text-red-400/60 hover:border-red-500/60 hover:bg-red-500/10 hover:text-red-400"
            }`}
          >
            Short
          </button>
        </div>

        {/* ── Price Input (Limit / Stop-Limit) ───────────────────────── */}
        {showPriceInput && (
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-foreground-muted text-xs font-medium">
                {orderType === "stop_limit" ? "Limit Price" : "Price"}
              </label>
              <button
                onClick={fillLimitFromMark}
                className="text-accent hover:text-accent/80 text-[10px] font-medium"
              >
                Last ${formatPrice(currentPrice)}
              </button>
            </div>
            <div className="relative">
              <input
                type="number"
                placeholder="0.00"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                className="bg-background-elevated text-foreground placeholder-foreground-disabled focus:border-accent w-full rounded-md border border-white/30 px-3 py-2 pr-14 text-sm transition-colors focus:outline-none"
                step="0.01"
                min="0"
              />
              <span className="text-foreground-muted absolute top-1/2 right-3 -translate-y-1/2 text-xs">
                USD
              </span>
            </div>
          </div>
        )}

        {/* ── Stop / Trigger Price ────────────────────────────────────── */}
        {showStopInput && (
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-foreground-muted text-xs font-medium">
                Trigger Price
              </label>
              <button
                onClick={fillStopFromMark}
                className="text-accent hover:text-accent/80 text-[10px] font-medium"
              >
                Last ${formatPrice(currentPrice)}
              </button>
            </div>
            <div className="relative">
              <input
                type="number"
                placeholder="0.00"
                value={stopPrice}
                onChange={(e) => setStopPrice(e.target.value)}
                className="bg-background-elevated text-foreground placeholder-foreground-disabled focus:border-accent w-full rounded-md border border-white/30 px-3 py-2 pr-14 text-sm transition-colors focus:outline-none"
                step="0.01"
                min="0"
              />
              <span className="text-foreground-muted absolute top-1/2 right-3 -translate-y-1/2 text-xs">
                USD
              </span>
            </div>
          </div>
        )}

        {/* ── Margin Input ───────────────────────────────────────────── */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-foreground-muted text-xs font-medium">
              Margin
            </label>
            <span className="text-foreground-subtle text-[10px]">
              Avbl: {formatBalance(freeMargin).replace("$", "")}{" "}
              {currentPair.collateral}
            </span>
          </div>
          <div className="relative">
            <input
              type="number"
              placeholder="0.00"
              value={collateralAmount}
              onChange={(e) => setCollateralAmount(e.target.value)}
              className="bg-background-elevated text-foreground placeholder-foreground-disabled focus:border-accent w-full rounded-md border border-white/30 px-3 py-2 pr-14 text-sm transition-colors focus:outline-none"
              step="0.01"
              min="0"
            />
            <span className="text-foreground-muted absolute top-1/2 right-3 -translate-y-1/2 text-xs">
              {currentPair.collateral}
            </span>
          </div>
          <div className="mt-1.5 flex gap-1">
            {[
              { label: "25%", factor: 0.25 },
              { label: "50%", factor: 0.5 },
              { label: "75%", factor: 0.75 },
              { label: "MAX", factor: 1 },
            ].map(({ label, factor }) => (
              <button
                key={label}
                onClick={() =>
                  setCollateralAmount((freeMargin * factor).toFixed(2))
                }
                className="bg-background-elevated text-foreground-muted hover:border-accent hover:text-accent flex-1 rounded border border-white/20 py-1 text-[10px] font-medium transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Leverage ───────────────────────────────────────────────── */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-foreground-muted text-xs font-medium">
              Leverage
            </label>
            <span className="text-foreground text-sm font-bold">
              {leverage}x
            </span>
          </div>
          <div className="flex gap-1">
            {LEVERAGE_PRESETS.map((lev) => (
              <button
                key={lev}
                onClick={() => setLeverage(lev)}
                className={`flex-1 rounded py-1 text-[10px] font-semibold transition-colors ${
                  leverage === lev
                    ? "bg-accent text-white"
                    : "bg-background-elevated text-foreground-muted hover:text-accent border border-white/20"
                }`}
              >
                {lev}x
              </button>
            ))}
          </div>
          <div className="mt-1.5">
            <input
              type="range"
              min="1"
              max={MAX_LEVERAGE}
              value={leverage}
              onChange={(e) => setLeverage(parseInt(e.target.value))}
              className="accent-accent h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gray-700"
            />
            <div className="text-foreground-subtle mt-0.5 flex justify-between text-[9px]">
              <span>1x</span>
              <span
                className={`font-medium ${
                  leverage <= 5
                    ? "text-positive"
                    : leverage <= 15
                      ? "text-yellow-400"
                      : "text-negative"
                }`}
              >
                {leverage <= 5
                  ? "Low Risk"
                  : leverage <= 15
                    ? "Medium"
                    : "High Risk"}
              </span>
              <span>{MAX_LEVERAGE}x</span>
            </div>
          </div>
        </div>

        {/* ── Time-in-Force selector ─────────────────────────────────── */}
        {showTifSelector && (
          <div>
            <label className="text-foreground-muted mb-1 block text-xs font-medium">
              Time in Force
            </label>
            <div className="flex gap-1">
              {TIF_OPTIONS.map(({ key, label, description }) => (
                <button
                  key={key}
                  onClick={() => setTimeInForce(key)}
                  title={description}
                  className={`flex-1 rounded py-1 text-[10px] font-semibold transition-colors ${
                    timeInForce === key
                      ? "bg-accent text-white"
                      : "bg-background-elevated text-foreground-muted hover:text-accent border border-white/20"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── TP / SL ────────────────────────────────────────────────── */}
        <div>
          <button
            onClick={() => setShowTpSl(!showTpSl)}
            className="text-foreground-muted hover:text-foreground flex w-full items-center justify-between text-xs font-medium transition-colors"
          >
            <span>TP / SL</span>
            <svg
              className={`h-3.5 w-3.5 transition-transform ${showTpSl ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {showTpSl && (
            <div className="mt-2 space-y-2">
              {/* Take Profit */}
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-foreground-muted mb-0.5 block text-[10px] font-medium">
                    Take Profit
                  </label>
                  <input
                    type="number"
                    placeholder="TP Price"
                    value={takeProfitPrice}
                    onChange={(e) => setTakeProfitPrice(e.target.value)}
                    className="bg-background-elevated text-foreground placeholder-foreground-disabled focus:border-positive w-full rounded border border-white/25 px-2 py-1.5 text-xs transition-colors focus:outline-none"
                    step="0.01"
                    min="0"
                  />
                </div>
                <div className="w-16 pt-3.5">
                  <div
                    className={`rounded px-1.5 py-1.5 text-center font-mono text-[10px] font-bold ${
                      tpPnlPercent < 0
                        ? "text-negative bg-red-500/10"
                        : "text-positive bg-green-500/10"
                    }`}
                  >
                    {tpPnlPercent
                      ? `${tpPnlPercent > 0 ? "+" : ""}${formatPercentage1(tpPnlPercent)}`
                      : "—"}
                  </div>
                </div>
                {takeProfitPrice && (
                  <button
                    onClick={() => setTakeProfitPrice("")}
                    className="text-foreground-muted hover:text-negative pt-3.5 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Stop Loss */}
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-foreground-muted mb-0.5 block text-[10px] font-medium">
                    Stop Loss
                  </label>
                  <input
                    type="number"
                    placeholder="SL Price"
                    value={stopLossPrice}
                    onChange={(e) => setStopLossPrice(e.target.value)}
                    className="bg-background-elevated text-foreground placeholder-foreground-disabled focus:border-negative w-full rounded border border-white/25 px-2 py-1.5 text-xs transition-colors focus:outline-none"
                    step="0.01"
                    min="0"
                  />
                </div>
                <div className="w-16 pt-3.5">
                  <div
                    className={`rounded px-1.5 py-1.5 text-center font-mono text-[10px] font-bold ${
                      slPnlPercent > 0
                        ? "text-positive bg-green-500/10"
                        : "text-negative bg-red-500/10"
                    }`}
                  >
                    {slPnlPercent
                      ? `${slPnlPercent > 0 ? "+" : ""}${formatPercentage1(slPnlPercent)}`
                      : "—"}
                  </div>
                </div>
                {stopLossPrice && (
                  <button
                    onClick={() => setStopLossPrice("")}
                    className="text-foreground-muted hover:text-negative pt-3.5 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Quick TP/SL presets */}
              <div className="flex gap-1">
                {[
                  { label: "+2%", isTp: true, pct: 0.02 },
                  { label: "+5%", isTp: true, pct: 0.05 },
                  { label: "-2%", isTp: false, pct: 0.02 },
                  { label: "-5%", isTp: false, pct: 0.05 },
                ].map(({ label, isTp, pct }) => (
                  <button
                    key={label}
                    onClick={() => {
                      const ref = entryPrice || currentPrice;
                      if (isTp) {
                        const tp =
                          orderSide === "long"
                            ? ref * (1 + pct)
                            : ref * (1 - pct);
                        setTakeProfitPrice(tp.toFixed(2));
                      } else {
                        const sl =
                          orderSide === "long"
                            ? ref * (1 - pct)
                            : ref * (1 + pct);
                        setStopLossPrice(sl.toFixed(2));
                      }
                    }}
                    className={`bg-background-elevated flex-1 rounded border border-white/20 px-1 py-1 text-[10px] font-medium transition-colors ${
                      isTp
                        ? "text-foreground-muted hover:border-positive/40 hover:text-positive"
                        : "text-foreground-muted hover:border-negative/40 hover:text-negative"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Submit + Summary ──────────────────────────────────────────── */}
      <div className="mt-auto p-3 pt-0">
        {/* Submit */}
        <button
          onClick={handleTrade}
          disabled={isSubmitting || !mounted}
          className={`w-full rounded-lg py-3 text-sm font-bold transition-all ${
            !mounted || !isConnected || isSubmitting
              ? "bg-background-elevated text-foreground-disabled cursor-not-allowed"
              : orderSide === "long"
                ? "bg-green-500 text-white hover:bg-green-400"
                : "bg-red-500 text-white hover:bg-red-400"
          }`}
        >
          {isSubmitting && (
            <svg
              className="mr-2 inline h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          )}
          {buttonText}
        </button>

        {/* Order Summary */}
        <div className="mt-3 space-y-1.5">
          {/* Price Info Bar */}
          <div className="space-y-1 rounded-md border border-white/10 bg-white/5 p-2">
            <div className="flex items-center justify-between">
              <span className="text-foreground-muted text-[10px]">
                Last Price
              </span>
              <span className="text-foreground font-mono text-xs font-bold">
                ${formatPrice(currentPrice)}
              </span>
            </div>
            {markPrice > 0 && markPrice !== currentPrice && (
              <div className="flex items-center justify-between">
                <span className="text-foreground-muted text-[10px]">
                  Mark Price
                </span>
                <span className="text-foreground font-mono text-[10px] font-semibold">
                  ${formatPrice(markPrice)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                <span className="text-foreground-muted text-[10px]">24h H</span>
                <span className="text-positive font-mono text-[10px] font-semibold">
                  {high24h > 0 ? `$${formatPrice(high24h)}` : "—"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-foreground-muted text-[10px]">24h L</span>
                <span className="text-negative font-mono text-[10px] font-semibold">
                  {low24h > 0 ? `$${formatPrice(low24h)}` : "—"}
                </span>
              </div>
            </div>
          </div>

          {[
            { label: "Size", value: `$${formatSizeUSD(sizeInUSD)}` },
            { label: "Entry Price", value: `$${formatPrice(entryPrice)}` },
            {
              label: "Liq. Price",
              value: `$${formatPrice(liquidationPrice)}`,
            },
            { label: "Fee (0.03%)", value: formatFee(tradingFee) },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="flex items-center justify-between py-0.5"
            >
              <span className="text-foreground-muted text-[11px]">{label}</span>
              <span className="text-foreground font-mono text-[11px] font-semibold">
                {value}
              </span>
            </div>
          ))}

          {/* Funding Rate */}
          {fundingRate !== undefined && (
            <div className="flex items-center justify-between py-0.5">
              <span className="text-foreground-muted text-[11px]">
                Funding
                {nextFundingTime && (
                  <span className="text-foreground-subtle ml-1 text-[9px]">
                    (
                    {new Date(nextFundingTime).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    )
                  </span>
                )}
              </span>
              <span
                className={`font-mono text-[11px] font-semibold ${fundingRate >= 0 ? "text-positive" : "text-negative"}`}
              >
                {fundingRate >= 0 ? "+" : ""}
                {(fundingRate * 100).toFixed(4)}%
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(TradingForm);
