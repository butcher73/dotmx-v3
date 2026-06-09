import Image from "next/image";

interface ChainIconProps {
  chainId: number;
  className?: string;
}

export const ChainIcon: React.FC<ChainIconProps> = ({
  chainId,
  className = "w-6 h-6",
}) => {
  const getChainIconConfig = (chainId: number) => {
    const configs = {
      // Arbitrum mainnet only
      42161: { src: "/img/token/arb.svg", alt: "Arbitrum One" },
    };

    return configs[chainId as keyof typeof configs];
  };

  const config = getChainIconConfig(chainId);

  if (!config) {
    // Fallback for unsupported chains
    return (
      <div
        className={`${className} flex items-center justify-center rounded-full bg-gray-500`}
      >
        <span className="text-xs font-bold text-white">?</span>
      </div>
    );
  }

  return (
    <div className={`${className} flex items-center justify-center`}>
      <Image
        src={config.src}
        alt={config.alt}
        width={24}
        height={24}
        className={className}
      />
    </div>
  );
};
