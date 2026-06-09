"use client";

import { Suspense, useEffect } from "react";
import { useAccount } from "@/hooks/useAuth";
import { StatusBar } from "@/components/common";
import {
  TradingChart,
  TradingForm,
  OrderBook,
  OrdersTable,
  TradingErrorBoundary,
  PositionChartSync,
} from "@/components/trading";
import TradeHeader from "@/components/trading/TradeHeader";
import { TradePairProvider, useTradePair } from "@/contexts/TradePairContext";
import { useUIAnalytics } from "@/hooks/useAnalytics";
import { AlertCircle } from "lucide-react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TIMEFRAME = "15m";

// ---------------------------------------------------------------------------
// Authentication fallback
// ---------------------------------------------------------------------------

function AuthenticationFallback() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <div className="bg-warning-subtle ring-warning/20 p-6 ring-1">
        <div className="text-warning flex items-center space-x-2">
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm font-medium">Please log in</span>
        </div>
        <p className="text-warning mt-2 text-sm">
          Please log in to view your trading activity
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Orders section (guarded by authentication)
// ---------------------------------------------------------------------------

function TradingOrdersSection() {
  const { isConnected } = useAccount();

  if (!isConnected) return <AuthenticationFallback />;

  return (
    <TradingErrorBoundary fallback={<AuthenticationFallback />}>
      <OrdersTable />
    </TradingErrorBoundary>
  );
}

// ---------------------------------------------------------------------------
// Main page content – reads everything from TradePairContext
// ---------------------------------------------------------------------------

function PerpTradingPageContent() {
  const { trackPageView } = useUIAnalytics();
  const { currentPair, wsState } = useTradePair();

  // Analytics
  useEffect(() => {
    trackPageView(`/trade/perp?symbol=${currentPair.bitgetSymbol}`, {
      symbol: currentPair.bitgetSymbol,
      asset: currentPair.asset,
    });
  }, [trackPageView, currentPair.bitgetSymbol, currentPair.asset]);

  return (
    <div className="bg-background flex min-h-screen flex-col overflow-hidden">
      {/* Header: logo + pair selector + market stats + user menu */}
      <TradeHeader />

      {/* Main trading interface */}
      <div className="flex min-h-0 flex-1">
        {/* Chart */}
        <div className="border-border min-w-0 flex-1 border-r">
          <PositionChartSync symbol={currentPair.symbol} />
          <TradingChart
            symbol={currentPair.bitgetSymbol}
            timeFrame={DEFAULT_TIMEFRAME}
            height="100%"
            className="h-full"
          />
        </div>

        {/* Order Book & Market Trades */}
        <div className="w-64 shrink-0">
          <OrderBook symbol={currentPair.bitgetSymbol} />
        </div>

        {/* Trading form */}
        <div className="w-80 shrink-0">
          <TradingForm />
        </div>
      </div>

      {/* Orders table */}
      <div className="border-border bg-background-card h-64 shrink-0 border-t">
        <TradingOrdersSection />
      </div>

      {/* Status bar */}
      <StatusBar
        bitgetConnectionStatus={{
          isConnected: wsState.isConnected,
          latency: 0,
          symbol: currentPair.bitgetSymbol,
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading fallback
// ---------------------------------------------------------------------------

function PerpTradingLoading() {
  return (
    <div className="bg-background flex h-screen w-full items-center justify-center">
      <div className="text-foreground-muted">Loading trading view...</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component — wraps everything in TradePairProvider
// ---------------------------------------------------------------------------

export default function PerpTradingPage() {
  return (
    <Suspense fallback={<PerpTradingLoading />}>
      <TradePairProvider>
        <PerpTradingPageContent />
      </TradePairProvider>
    </Suspense>
  );
}
