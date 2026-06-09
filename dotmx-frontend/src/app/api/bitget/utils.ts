import { NextResponse } from "next/server";

// Bitget V2 API configuration
export const BITGET_API_BASE = "https://api.bitget.com/api/v2/mix/market";
export const BITGET_PRODUCT_TYPE = "USDT-FUTURES";
export const BITGET_SUCCESS_CODE = "00000";

// Granularity mapping for TradingView to Bitget V2 format
// Bitget V2 API requires: 1m,3m,5m,15m,30m,1H,4H,6H,12H,1D,1W,1M
export const GRANULARITY_MAP: Record<string, string> = {
  // Standard formats
  "1min": "1m",
  "3min": "3m",
  "5min": "5m",
  "15min": "15m",
  "30min": "30m",
  "1h": "1H",
  "4h": "4H",
  "6h": "6H",
  "12h": "12H",
  "1day": "1D",
  "1week": "1W",
  "1M": "1M",
  // TradingView numeric format mappings
  "1": "1m",
  "3": "3m",
  "5": "5m",
  "15": "15m",
  "30": "30m",
  "60": "1H",
  "240": "4H",
  "360": "6H",
  "720": "12H",
  "1D": "1D",
  "1W": "1W",
  // Already in correct format (normalize case for V2)
  "1m": "1m",
  "3m": "3m",
  "5m": "5m",
  "15m": "15m",
  "30m": "30m",
  "1H": "1H",
  "4H": "4H",
  "6H": "6H",
  "12H": "12H",
};

// Base response interface
export interface BitgetBaseResponse {
  code: string;
  msg: string;
  requestTime: number;
}

// Convert granularity to Bitget V2 format
export function toBitgetGranularity(granularity: string): string {
  return GRANULARITY_MAP[granularity] || granularity;
}

// Build Bitget API URL
export function buildBitgetUrl(
  endpoint: string,
  params: Record<string, string>
): string {
  const searchParams = new URLSearchParams({
    ...params,
    productType: BITGET_PRODUCT_TYPE,
  });
  return `${BITGET_API_BASE}/${endpoint}?${searchParams.toString()}`;
}

// Fetch from Bitget API with error handling
export async function fetchBitget<T extends BitgetBaseResponse>(
  url: string
): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Bitget API] HTTP error ${response.status}: ${errorText}`);
    throw new Error(
      `Bitget API error: ${response.status} ${response.statusText}`
    );
  }

  const data: T = await response.json();

  if (data.code !== BITGET_SUCCESS_CODE) {
    console.error(`[Bitget API] Error code ${data.code}: ${data.msg}`);
    throw new Error(`Bitget API error: ${data.msg}`);
  }

  return data;
}

// Standard error response
export function errorResponse(error: unknown, status = 500) {
  console.error("[Bitget API] Error:", error);
  return NextResponse.json(
    {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: Date.now(),
    },
    { status }
  );
}

// Standard success response
export function successResponse<T>(data: T, extra?: Record<string, unknown>) {
  return NextResponse.json({
    success: true,
    data,
    timestamp: Date.now(),
    ...extra,
  });
}
