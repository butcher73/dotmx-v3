import { NextRequest } from "next/server";
import {
  type BitgetBaseResponse,
  buildBitgetUrl,
  errorResponse,
  fetchBitget,
  successResponse,
  toBitgetGranularity,
} from "../utils";

export const runtime = "edge";

interface BitgetKlineResponse extends BitgetBaseResponse {
  data: string[][]; // [timestamp, open, high, low, close, baseVolume, quoteVolume, usdtVolume]
}

interface CandlestickData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume: number;
  usdtVolume: number;
}

function parseCandle(candle: string[]): CandlestickData {
  return {
    timestamp: parseInt(candle[0] || "0"),
    open: parseFloat(candle[1] || "0"),
    high: parseFloat(candle[2] || "0"),
    low: parseFloat(candle[3] || "0"),
    close: parseFloat(candle[4] || "0"),
    volume: parseFloat(candle[5] || "0"),
    quoteVolume: parseFloat(candle[6] || "0"),
    usdtVolume: parseFloat(candle[7] || candle[6] || "0"),
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawSymbol = searchParams.get("symbol") || "BTCUSDT";
    // Strip _UMCBL suffix if present - Bitget V2 API uses plain symbol format
    const symbol = rawSymbol.replace(/_UMCBL$|_DMCBL$|_CMCBL$/i, "");
    const granularity = searchParams.get("granularity") || "1m";
    const limit = searchParams.get("limit") || "200";

    const url = buildBitgetUrl("candles", {
      symbol,
      granularity: toBitgetGranularity(granularity),
      limit,
    });

    const data = await fetchBitget<BitgetKlineResponse>(url);
    const formattedData = data.data.map(parseCandle);

    return successResponse(formattedData, { symbol, granularity });
  } catch (error) {
    return errorResponse(error);
  }
}
