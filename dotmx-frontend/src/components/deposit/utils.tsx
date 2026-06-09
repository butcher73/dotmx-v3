import {
  Clock,
  Loader2,
  CheckCircle2,
  Zap,
  XCircle,
  LucideIcon,
} from "lucide-react";

interface StatusDisplay {
  Icon: LucideIcon;
  iconColor: string;
  variant: "info" | "warning" | "success" | "danger";
  label: string;
}

export const getStatusDisplay = (status: string): StatusDisplay => {
  switch (status) {
    case "detected":
      return {
        Icon: Clock,
        iconColor: "text-amber-400",
        variant: "warning",
        label: "Detected",
      };
    case "confirming":
      return {
        Icon: Loader2,
        iconColor: "text-blue-400",
        variant: "info",
        label: "Confirming",
      };
    case "confirmed":
      return {
        Icon: CheckCircle2,
        iconColor: "text-emerald-400",
        variant: "success",
        label: "Confirmed",
      };
    case "swept":
    case "completed":
      return {
        Icon: Zap,
        iconColor: "text-emerald-400",
        variant: "success",
        label: "Credited",
      };
    case "failed":
      return {
        Icon: XCircle,
        iconColor: "text-red-400",
        variant: "danger",
        label: "Failed",
      };
    default:
      return {
        Icon: Clock,
        iconColor: "text-zinc-500",
        variant: "info",
        label: status,
      };
  }
};

/**
 * Check if a network is EVM-based (Ethereum Virtual Machine)
 * EVM chains share the same address for all tokens on that chain
 */
export const isEVMNetwork = (networkCode: string): boolean => {
  const evmNetworks = [
    "ETH",
    "ETHEREUM",
    "SEP",
    "SEPOLIA",
    "POLYGON",
    "MATIC",
    "BSC",
    "BNB",
    "ARBITRUM",
    "ARB",
    "OPTIMISM",
    "OP",
    "AVALANCHE",
    "AVAX",
    "BASE",
  ];
  return evmNetworks.includes(networkCode.toUpperCase());
};
