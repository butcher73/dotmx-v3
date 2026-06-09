import { useState } from "react";
import Image from "next/image";

interface AssetIconProps {
  iconUrl?: string | null | undefined;
  symbol: string;
  size?: number;
}

export function AssetIcon({ iconUrl, symbol, size = 32 }: AssetIconProps) {
  const [imageError, setImageError] = useState(false);

  if (!iconUrl || imageError) {
    return (
      <div
        className="text-foreground flex items-center justify-center rounded-full font-semibold"
        style={{
          width: size,
          height: size,
          backgroundColor: "#fa5f1a",
          fontSize: size > 40 ? "16px" : "12px",
        }}
      >
        {symbol ? symbol.slice(0, 2).toUpperCase() : "??"}
      </div>
    );
  }

  return (
    <Image
      src={iconUrl}
      alt={symbol}
      width={size}
      height={size}
      className="rounded-full"
      onError={() => setImageError(true)}
    />
  );
}
