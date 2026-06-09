import { NextRequest } from "next/server";
import {
  type BitgetBaseResponse,
  buildBitgetUrl,
  errorResponse,
  fetchBitget,
  successResponse,
} from "../utils";

export const runtime = "edge";

interface BitgetTickerData {
  symbol: string;
  high24h: string;
  open: string;
  low24h: string;
  lastPr: string;
  quoteVolume: string;
  baseVolume: string;
  usdtVolume: string;
  bidPr: string;
  askPr: string;
  bidSz: string;
  askSz: string;
  openUtc: string;
  ts: string;
  changeUtc24h: string;
  change24h: string;
}

interface BitgetTickerResponse extends BitgetBaseResponse {
  data: BitgetTickerData[];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol") || "BTCUSDT";

    const url = buildBitgetUrl("ticker", { symbol });
    const data = await fetchBitget<BitgetTickerResponse>(url);

    // Ensure array format for response
    const responseData = Array.isArray(data.data)
      ? data.data
      : data.data
        ? [data.data]
        : [];

    return successResponse(responseData);
  } catch (error) {
    return errorResponse(error);
  }
}
