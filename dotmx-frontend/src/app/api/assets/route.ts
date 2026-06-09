import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "edge";

// Mock supported assets for MVP
const MOCK_ASSETS = [
  {
    symbol: "USDC",
    name: "USD Coin",
    asset_type: "crypto" as const,
    icon_url: "/img/token/usdc.svg",
    decimal_places: 6,
    is_active: true,
    networks: [
      {
        network_code: "ARBITRUM",
        network_name: "Arbitrum One",
        contract_address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        decimal_places: 6,
        min_deposit: "1",
        min_withdrawal: "10",
        withdrawal_fee: "0.5",
        deposit_enabled: true,
        withdrawal_enabled: true,
      },
      {
        network_code: "BASE",
        network_name: "Base",
        contract_address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        decimal_places: 6,
        min_deposit: "1",
        min_withdrawal: "10",
        withdrawal_fee: "0.3",
        deposit_enabled: true,
        withdrawal_enabled: true,
      },
      {
        network_code: "ETH",
        network_name: "Ethereum",
        contract_address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        decimal_places: 6,
        min_deposit: "10",
        min_withdrawal: "50",
        withdrawal_fee: "5",
        deposit_enabled: true,
        withdrawal_enabled: true,
      },
    ],
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    asset_type: "crypto" as const,
    icon_url: "/img/token/usdt.svg",
    decimal_places: 6,
    is_active: true,
    networks: [
      {
        network_code: "ARBITRUM",
        network_name: "Arbitrum One",
        contract_address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
        decimal_places: 6,
        min_deposit: "1",
        min_withdrawal: "10",
        withdrawal_fee: "0.5",
        deposit_enabled: true,
        withdrawal_enabled: true,
      },
      {
        network_code: "BSC",
        network_name: "BNB Smart Chain",
        contract_address: "0x55d398326f99059fF775485246999027B3197955",
        decimal_places: 18,
        min_deposit: "1",
        min_withdrawal: "10",
        withdrawal_fee: "0.3",
        deposit_enabled: true,
        withdrawal_enabled: true,
      },
    ],
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    asset_type: "crypto" as const,
    icon_url: "/img/token/eth.svg",
    decimal_places: 18,
    is_active: true,
    networks: [
      {
        network_code: "ARBITRUM",
        network_name: "Arbitrum One",
        contract_address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
        decimal_places: 18,
        min_deposit: "0.001",
        min_withdrawal: "0.01",
        withdrawal_fee: "0.0005",
        deposit_enabled: true,
        withdrawal_enabled: true,
      },
      {
        network_code: "BASE",
        network_name: "Base",
        contract_address: "0x4200000000000000000000000000000000000006",
        decimal_places: 18,
        min_deposit: "0.001",
        min_withdrawal: "0.01",
        withdrawal_fee: "0.0003",
        deposit_enabled: true,
        withdrawal_enabled: true,
      },
    ],
  },
  {
    symbol: "WBTC",
    name: "Wrapped Bitcoin",
    asset_type: "crypto" as const,
    icon_url: "/img/token/btc.svg",
    decimal_places: 8,
    is_active: true,
    networks: [
      {
        network_code: "ARBITRUM",
        network_name: "Arbitrum One",
        contract_address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
        decimal_places: 8,
        min_deposit: "0.0001",
        min_withdrawal: "0.001",
        withdrawal_fee: "0.00005",
        deposit_enabled: true,
        withdrawal_enabled: true,
      },
    ],
  },
];

const MOCK_NETWORKS = [
  {
    code: "ARBITRUM",
    name: "Arbitrum One",
    chain_id: "42161",
    is_active: true,
    confirmations_required: 12,
    deposit_enabled: true,
    withdrawal_enabled: true,
  },
  {
    code: "BASE",
    name: "Base",
    chain_id: "8453",
    is_active: true,
    confirmations_required: 12,
    deposit_enabled: true,
    withdrawal_enabled: true,
  },
  {
    code: "ETH",
    name: "Ethereum",
    chain_id: "1",
    is_active: true,
    confirmations_required: 32,
    deposit_enabled: true,
    withdrawal_enabled: true,
  },
  {
    code: "BSC",
    name: "BNB Smart Chain",
    chain_id: "56",
    is_active: true,
    confirmations_required: 15,
    deposit_enabled: true,
    withdrawal_enabled: true,
  },
];

// Mock user balances (would come from database in production)
function getMockBalances() {
  return [
    {
      asset_symbol: "USDC",
      asset_name: "USD Coin",
      icon_url: "/img/token/usdc.svg",
      available: "1250.50",
      locked: "0",
      pending: "0",
      total: "1250.50",
      updated_at: new Date().toISOString(),
    },
    {
      asset_symbol: "ETH",
      asset_name: "Ethereum",
      icon_url: "/img/token/eth.svg",
      available: "0.5432",
      locked: "0.1",
      pending: "0",
      total: "0.6432",
      updated_at: new Date().toISOString(),
    },
    {
      asset_symbol: "WBTC",
      asset_name: "Wrapped Bitcoin",
      icon_url: "/img/token/btc.svg",
      available: "0.0125",
      locked: "0",
      pending: "0",
      total: "0.0125",
      updated_at: new Date().toISOString(),
    },
  ];
}

// Generate a deterministic mock address based on network
function generateMockAddress(networkCode: string): string {
  const prefixes: Record<string, string> = {
    ARBITRUM: "0x7a",
    BASE: "0x8b",
    ETH: "0x3c",
    BSC: "0x5d",
  };
  const prefix = prefixes[networkCode] || "0x00";
  const hash = networkCode
    .split("")
    .reduce((a, c) => a + c.charCodeAt(0), 0)
    .toString(16);
  return `${prefix}${hash}${"a".repeat(38)}`.slice(0, 42);
}

/**
 * GET /api/assets
 * Returns supported assets and networks - MVP version with mock data
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  // For MVP, return mock data directly
  // TODO: Connect to real backend when ready
  if (type === "networks") {
    return NextResponse.json({ networks: MOCK_NETWORKS });
  }

  if (type === "balances") {
    return NextResponse.json({ balances: getMockBalances() });
  }

  if (type === "addresses") {
    return NextResponse.json({ addresses: [] });
  }

  // Default: return supported assets
  return NextResponse.json({ assets: MOCK_ASSETS });
}

/**
 * POST /api/assets
 * Handle deposit address generation and withdrawals
 */
export async function POST(request: Request) {
  const body = await request.json();
  const { action, network_code, asset_symbol, amount, destination_address } =
    body;

  // Note: This runs SERVER-SIDE (Next.js API route), can use localhost URLs
  // But in dev, should match NEXT_PUBLIC_API_URL setup. In prod, this would be the internal API URL
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken")?.value;

  try {
    if (action === "get_deposit_address") {
      // Try backend first
      const depositHeaders: HeadersInit = accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : {};
      const response = await fetch(
        `${apiUrl}/assets/deposit-address/${network_code}`,
        {
          method: "GET",
          headers: depositHeaders,
        }
      );

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json(data);
      }

      // Fallback to mock address
      const mockAddress = {
        id: `addr_${Date.now()}`,
        network_code,
        network_name:
          MOCK_NETWORKS.find((n) => n.code === network_code)?.name ||
          network_code,
        address: generateMockAddress(network_code),
        created_at: new Date().toISOString(),
      };

      return NextResponse.json({
        address: mockAddress,
        is_new: true,
        message: "Deposit address generated successfully (mock)",
      });
    }

    if (action === "withdraw") {
      // Try backend first
      const withdrawHeaders: HeadersInit = {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      };
      const response = await fetch(`${apiUrl}/assets/withdraw`, {
        method: "POST",
        headers: withdrawHeaders,
        body: JSON.stringify({
          asset_symbol,
          network_code,
          amount,
          destination_address,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json(data);
      }

      // Fallback to mock withdrawal (in production would fail)
      return NextResponse.json({
        withdrawal: {
          id: `wd_${Date.now()}`,
          asset_symbol,
          network_code,
          amount,
          fee: "0.5",
          net_amount: (parseFloat(amount) - 0.5).toString(),
          destination_address,
          status: "pending_approval",
          created_at: new Date().toISOString(),
        },
        message: "Withdrawal request submitted (mock)",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch {
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
