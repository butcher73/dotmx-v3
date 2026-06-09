import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { env } from "@/config/env";
import ChartDebugInfo from "./ChartDebugInfo";
import { tradingViewDatafeed } from "@/services/TradingViewDatafeed";
import { positionService } from "@/services/PositionService";
import {
  brokerConfig,
  createBrokerTerminal,
} from "@/services/TradingTerminalBroker";

interface RealtimeTradingChartProps {
  symbol?: string;
  timeFrame?: string;
  height?: string;
  className?: string;
}

const CHART_DEBUG = env.chartDebug;

/**
 * Real-time Trading Chart Component
 *
 * Features:
 * - WebSocket-based real-time price streaming
 * - Trading Terminal integration for position visualization
 * - Technical indicators (EMA 7/25/99)
 * - Dark theme optimized for trading
 * - Auto-refresh on symbol/timeframe changes
 */
const RealtimeTradingChart: React.FC<RealtimeTradingChartProps> = ({
  symbol = "BTCUSDC",
  timeFrame = "1",
  height = "600px",
  className = "",
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any

  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSymbol, setCurrentSymbol] = useState(symbol);
  const [currentTimeFrame, setCurrentTimeFrame] = useState(timeFrame);

  /**
   * Convert various timeframe formats to TradingView format
   * Supports: 1m, 5m, 15m, 30m, 1H, 4H, 1D, 1W, 1M
   */
  const convertTimeFrame = (tf: string): string => {
    const timeFrameMap: { [key: string]: string } = {
      "1m": "1",
      "5m": "5",
      "15m": "15",
      "30m": "30",
      "1H": "60",
      "4H": "240",
      "1D": "1D",
      "1W": "1W",
      "1M": "1M",
      "1": "1",
      "5": "5",
      "15": "15",
      "30": "30",
      "60": "60",
      "240": "240",
      "1440": "1D",
    };
    return timeFrameMap[tf] || "1";
  };

  // Initialize client-side rendering (Next.js hydration)
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Update internal state when props change
  useEffect(() => {
    if (symbol !== currentSymbol || timeFrame !== currentTimeFrame) {
      setCurrentSymbol(symbol || "BTCUSDC");
      setCurrentTimeFrame(timeFrame || "1");
    }
  }, [symbol, timeFrame, currentSymbol, currentTimeFrame]);

  /**
   * Main chart initialization with TradingView library
   * Sets up:
   * - Real-time WebSocket datafeed
   * - Trading Terminal broker integration
   * - Technical indicators
   * - Dark theme styling
   */
  useEffect(() => {
    if (!isClient || !chartContainerRef.current) return;

    let mounted = true;

    const initializeRealtimeChart = async () => {
      try {
        setError(null);
        setIsLoading(true);

        // Wait for TradingView library to load
        const maxAttempts = 50;
        let attempts = 0;

        while (!window.TradingView && attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          attempts++;
        }

        if (!window.TradingView || !window.TradingView.widget) {
          throw new Error("TradingView library failed to load");
        }

        const { widget } = window.TradingView;

        if (!mounted) return;

        // Clear previous chart instance
        if (chartContainerRef.current) {
          chartContainerRef.current.innerHTML = "";
        }

        const validSymbol = currentSymbol || "BTCUSDC";
        const validTimeFrame = convertTimeFrame(currentTimeFrame);

        // Initialize TradingView widget with broker integration
        const tvWidget = new widget({
          container: chartContainerRef.current!,
          autosize: true,
          symbol: validSymbol,
          interval: validTimeFrame as any, // eslint-disable-line @typescript-eslint/no-explicit-any
          datafeed: tradingViewDatafeed,

          // Trading Terminal integration for position management
          broker_config: brokerConfig,
          broker_factory: createBrokerTerminal,

          // Library configuration
          library_path: "/charting_library/",
          locale: "en",
          debug: false,
          client_id: "dotmx-realtime-chart",
          user_id: "dotmx-user",

          // Disable unnecessary features
          disabled_features: [
            "study_templates",
            "header_saveload",
            "chart_crosshair_menu",
            "use_localstorage_for_settings",
            "save_chart_properties_to_local_storage",
            "trading_account_manager",
            "header_symbol_search",
          ],

          // Enable essential features
          enabled_features: [
            "dont_show_boolean_study_arguments",
            "hide_last_na_study_output",
            "move_logo_to_main_pane",
            "side_toolbar_in_fullscreen_mode",
            "header_chart_type",
            "header_compare",
            "header_undo_redo",
            "timeframes_toolbar",
            "tick_resolution",
          ],

          // Dark theme configuration
          fullscreen: false,
          theme: "dark",
          toolbar_bg: "#000000",
          custom_css_url: "/tradingview-dark.css",
          loading_screen: {
            backgroundColor: "#000000",
            foregroundColor: "#3A8DFF",
          },

          // Custom timeframe buttons
          time_frames: [
            { text: "5m", resolution: "5" as any, description: "5 Minutes" },
            { text: "15m", resolution: "15" as any, description: "15 Minutes" },
            { text: "1h", resolution: "60" as any, description: "1 Hour" },
            { text: "4h", resolution: "240" as any, description: "4 Hours" },
            { text: "1d", resolution: "1D" as any, description: "1 Day" },
          ],

          // Chart styling overrides
          overrides: {
            "paneProperties.background": "#000000",
            "paneProperties.backgroundGradientStartColor": "#000000",
            "paneProperties.backgroundGradientEndColor": "#000000",
            "paneProperties.backgroundType": "solid",
            "paneProperties.vertGridProperties.color": "#0a0a0a",
            "paneProperties.horzGridProperties.color": "#0a0a0a",
            "paneProperties.crossHairProperties.color": "#3A8DFF",
            "paneProperties.crossHairProperties.width": 1,
            "paneProperties.crossHairProperties.style": 2,

            // Candlestick colors - using design system colors
            "mainSeriesProperties.candleStyle.upColor": "#00D897",
            "mainSeriesProperties.candleStyle.downColor": "#FF6B6B",
            "mainSeriesProperties.candleStyle.borderUpColor": "#00D897",
            "mainSeriesProperties.candleStyle.borderDownColor": "#FF6B6B",
            "mainSeriesProperties.candleStyle.wickUpColor": "#00D897",
            "mainSeriesProperties.candleStyle.wickDownColor": "#FF6B6B",

            // Price scale colors
            "scalesProperties.textColor": "#9ca3af",
            "scalesProperties.backgroundColor": "#000000",
            "scalesProperties.lineColor": "#0a0a0a",
            "scalesProperties.fontSize": 12,
            "scalesProperties.showSeriesLastValue": true,

            // Price line
            "mainSeriesProperties.priceLineColor": "#3A8DFF",
            "mainSeriesProperties.priceLineWidth": 1,
            "mainSeriesProperties.showPriceLine": true,

            // Real-time performance optimizations
            "timeScale.rightOffset": 5,
            "timeScale.barSpacing": 8,
            "timeScale.minBarSpacing": 0.5,
            "timeScale.lockVisibleTimeRangeOnResize": false,
            "timeScale.rightBarStaysOnScroll": true,
            "mainSeriesProperties.style": 1,
            "mainSeriesProperties.showCountdown": true,
            "mainSeriesProperties.statusViewStyle.showInterval": true,
            // Volume styling (design system: negative / positive)
            "volume.volume.color.0": "#FF6B6B50",
            "volume.volume.color.1": "#00D89750",
            "volume.volume.transparency": 50,

            // Legend configuration
            "paneProperties.legendProperties.showLegend": true,
            "paneProperties.legendProperties.showStudyArguments": true,
            "paneProperties.legendProperties.showStudyTitles": true,
            "paneProperties.legendProperties.showStudyValues": true,
            "paneProperties.legendProperties.showSeriesTitle": true,
            "paneProperties.legendProperties.showSeriesOHLC": true,
            "paneProperties.legendProperties.showBarChange": true,

            // Separator line
            "paneProperties.separatorColor": "#0a0a0a",
          },

          // Study-specific overrides
          studies_overrides: {
            "volume.volume.color.0": "#FF6B6B",
            "volume.volume.color.1": "#00D897",
            "volume.volume.transparency": 65,
          },
        });

        widgetRef.current = tvWidget;

        // Configure chart when ready
        tvWidget.onChartReady(() => {
          if (!mounted) return;

          try {
            tvWidget.headerReady().then(() => {
              const chart = tvWidget.activeChart();

              // Add default EMA indicators (design system colors)
              chart.createStudy(
                "Moving Average Exponential",
                false,
                false,
                { length: 7 },
                {
                  "plot.color": "#3A8DFF", // accent
                  "plot.linewidth": 1,
                }
              );

              chart.createStudy(
                "Moving Average Exponential",
                false,
                false,
                { length: 25 },
                {
                  "plot.color": "#F59E0B", // warning
                  "plot.linewidth": 1,
                }
              );

              chart.createStudy(
                "Moving Average Exponential",
                false,
                false,
                { length: 99 },
                {
                  "plot.color": "#A855F7", // info
                  "plot.linewidth": 1,
                }
              );

              // Initialize position service for position line visualization
              positionService.initialize(chart);
            });
          } catch (e) {
            console.error("[RealtimeTradingChart] Indicators setup failed:", e);
          }

          setIsLoading(false);
        });
      } catch (err) {
        console.error("[RealtimeTradingChart] Initialization failed:", err);
        if (mounted) {
          setError(
            err instanceof Error ? err.message : "Chart initialization failed"
          );
          setIsLoading(false);
        }
      }
    };

    initializeRealtimeChart();

    // Cleanup function
    return () => {
      mounted = false;

      if (widgetRef.current) {
        try {
          widgetRef.current.remove();
        } catch (cleanupError) {
          console.error("[RealtimeTradingChart] Cleanup error:", cleanupError);
        }
        widgetRef.current = null;
      }
    };
  }, [isClient, currentSymbol, currentTimeFrame]);

  // Don't render on server side
  if (!isClient) {
    return (
      <div
        className={`bg-background flex items-center justify-center ${className}`}
        style={{ height }}
      >
        <div className="text-foreground-muted">Loading chart...</div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Loading State */}
      {isLoading && (
        <div
          className="bg-background absolute inset-0 z-50 flex items-center justify-center"
          style={{ height }}
        >
          <div className="flex flex-col items-center space-y-4">
            <Image
              src="/logomark-color.svg"
              alt="dotmx"
              width={48}
              height={48}
              unoptimized
              className="animate-pulse"
            />
            <div className="text-foreground-muted">Initializing chart...</div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div
          className="bg-background absolute inset-0 z-40 flex items-center justify-center"
          style={{ height }}
        >
          <div className="text-center">
            <div className="text-negative mb-2">Chart Error</div>
            <div className="text-foreground-muted text-sm">{error}</div>
            <button
              onClick={() => {
                setError(null);
                setIsLoading(true);
              }}
              className="bg-accent hover:bg-accent-hover mt-4 rounded px-4 py-2 text-white transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Chart Container */}
      <div ref={chartContainerRef} className="w-full" style={{ height }} />

      {/* Watermark Overlay */}
      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
        <div className="relative h-[30%] w-[30%]">
          <Image
            src="/logo-light.svg"
            alt="dotmx watermark"
            fill
            unoptimized
            className="object-contain opacity-[0.03]"
            priority
          />
        </div>
      </div>

      {/* Debug Info */}
      {CHART_DEBUG && (
        <div className="absolute top-4 left-4 z-30">
          <ChartDebugInfo symbol={currentSymbol} timeFrame={currentTimeFrame} />
        </div>
      )}
    </div>
  );
};

export default RealtimeTradingChart;
