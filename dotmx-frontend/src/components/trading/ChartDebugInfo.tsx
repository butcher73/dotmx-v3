"use client";

import React, { useState, useEffect } from "react";

interface ChartDebugInfoProps {
  symbol?: string;
  timeFrame?: string;
}

interface ApiTestData {
  dataLength: number;
  firstBar?: { timestamp: number };
  lastBar?: { timestamp: number };
  symbol: string;
  granularity: string;
}

interface ApiTestResult {
  status: "loading" | "success" | "error";
  data?: ApiTestData;
  error?: string;
  timestamp?: number;
}

const ChartDebugInfo: React.FC<ChartDebugInfoProps> = ({
  symbol = "BTCUSDC",
  timeFrame = "1min",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [apiTest, setApiTest] = useState<ApiTestResult>({ status: "loading" });

  const testApiEndpoint = React.useCallback(async () => {
    setApiTest({ status: "loading" });

    try {
      const url = `/api/bitget/candlestick?symbol=${symbol}&granularity=${timeFrame}&limit=100`;

      const response = await fetch(url);
      const data = await response.json();

      if (response.ok && data.success) {
        setApiTest({
          status: "success",
          data: {
            dataLength: data.data?.length || 0,
            firstBar: data.data?.[0],
            lastBar: data.data?.[data.data?.length - 1],
            symbol: data.symbol,
            granularity: data.granularity,
          },
          timestamp: Date.now(),
        });
      } else {
        setApiTest({
          status: "error",
          error: data.error || `HTTP ${response.status}`,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      setApiTest({
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: Date.now(),
      });
    }
  }, [symbol, timeFrame]);

  useEffect(() => {
    if (isOpen) {
      testApiEndpoint();
    }
  }, [isOpen, testApiEndpoint]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed right-4 bottom-4 z-50 rounded-lg bg-blue-600 px-3 py-2 text-xs text-white transition-colors hover:bg-blue-700"
      >
        Debug Chart
      </button>
    );
  }

  return (
    <div className="fixed right-4 bottom-4 z-50 max-w-md rounded-lg border border-slate-700 bg-slate-900 p-4 text-xs text-white">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Chart Debug Info</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-slate-400 hover:text-white"
        >
          ✕
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <div className="text-slate-400">Current Settings:</div>
          <div>Symbol: {symbol}</div>
          <div>TimeFrame: {timeFrame}</div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-slate-400">API Test:</span>
            <button
              onClick={testApiEndpoint}
              className="rounded bg-blue-600 px-2 py-1 text-xs hover:bg-blue-700"
            >
              Retry
            </button>
          </div>

          {apiTest.status === "loading" && (
            <div className="text-yellow-400">Testing API endpoint...</div>
          )}

          {apiTest.status === "success" && apiTest.data && (
            <div className="space-y-1">
              <div className="text-green-400">✓ API Success</div>
              <div>Bars: {apiTest.data.dataLength}</div>
              <div>Symbol: {apiTest.data.symbol}</div>
              <div>Granularity: {apiTest.data.granularity}</div>
              {apiTest.data.firstBar && (
                <div>
                  First:{" "}
                  {new Date(
                    apiTest.data.firstBar.timestamp
                  ).toLocaleTimeString()}
                </div>
              )}
              {apiTest.data.lastBar && (
                <div>
                  Last:{" "}
                  {new Date(
                    apiTest.data.lastBar.timestamp
                  ).toLocaleTimeString()}
                </div>
              )}
            </div>
          )}

          {apiTest.status === "error" && (
            <div className="space-y-1">
              <div className="text-red-400">✗ API Error</div>
              <div className="text-red-300">{apiTest.error}</div>
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 text-slate-400">Troubleshooting:</div>
          <div className="space-y-1 text-xs">
            <div>• Check browser console for errors</div>
            <div>• Verify symbol format (e.g., BTCUSDC)</div>
            <div>• Check network connectivity</div>
            <div>• Try different timeframes</div>
          </div>
        </div>

        {apiTest.timestamp && (
          <div className="text-xs text-slate-500">
            Last test: {new Date(apiTest.timestamp).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChartDebugInfo;
