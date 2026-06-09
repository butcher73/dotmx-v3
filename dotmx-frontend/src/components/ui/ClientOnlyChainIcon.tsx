"use client";

import { ChainIcon } from "./ChainIcon";

interface ClientOnlyChainIconProps {
  chainId: number;
  className?: string;
}

export const ClientOnlyChainIcon: React.FC<ClientOnlyChainIconProps> = ({
  chainId,
  className = "w-6 h-6",
}) => {
  // Direct render with suppressHydrationWarning to prevent mismatch
  return <ChainIcon chainId={chainId} className={className} />;
};
