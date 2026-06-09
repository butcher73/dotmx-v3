import { TrendingUp, Users, Zap } from "lucide-react";

export default function WhatYouTradeSection() {
  return (
    <section className="border-t border-gray-800 py-32">
      <div className="container mx-auto px-6">
        <div className="mb-24 text-center">
          <h2 className="mb-16 text-5xl font-bold lg:text-6xl">
            <span className="gradient-text-silver">What You Trade</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Card 1 */}
          <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-linear-to-b from-white/[0.03] to-transparent p-6 backdrop-blur-xl transition-all duration-500 hover:border-[#3A8DFF]/30 hover:bg-white/[0.05]">
            <div className="absolute top-0 left-0 h-0 w-1 bg-linear-to-b from-[#3A8DFF] to-transparent transition-all duration-500 group-hover:h-full" />
            <div className="absolute inset-0 bg-linear-to-br from-[#3A8DFF]/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

            <div className="relative flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-[#3A8DFF] to-[#00D1FF] shadow-lg shadow-[#3A8DFF]/20 transition-all duration-500 group-hover:scale-105">
                <TrendingUp className="h-8 w-8 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="mb-1 text-lg font-bold text-white transition-colors duration-300 group-hover:text-[#3A8DFF]">
                  Orderbook-based perpetuals
                </h3>
                <p className="text-sm text-[#A3B8D9]/80">
                  Real orderbook matching, not synthetic pricing or pooled
                  liquidity.
                </p>
              </div>
            </div>
          </div>

          {/* Card 2 */}
          <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-linear-to-b from-white/[0.03] to-transparent p-6 backdrop-blur-xl transition-all duration-500 hover:border-[#00D1FF]/30 hover:bg-white/[0.05]">
            <div className="absolute top-0 left-0 h-0 w-1 bg-linear-to-b from-[#00D1FF] to-transparent transition-all duration-500 group-hover:h-full" />
            <div className="absolute inset-0 bg-linear-to-br from-[#00D1FF]/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

            <div className="relative flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-[#00D1FF] to-[#3A8DFF] shadow-lg shadow-[#00D1FF]/20 transition-all duration-500 group-hover:scale-105">
                <TrendingUp className="h-8 w-8 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="mb-1 text-lg font-bold text-white transition-colors duration-300 group-hover:text-[#00D1FF]">
                  Long and short positions
                </h3>
                <p className="text-sm text-[#A3B8D9]/80">
                  Go long or short on perpetual contracts with full flexibility.
                </p>
              </div>
            </div>
          </div>

          {/* Card 3 */}
          <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-linear-to-b from-white/[0.03] to-transparent p-6 backdrop-blur-xl transition-all duration-500 hover:border-[#3A8DFF]/30 hover:bg-white/[0.05]">
            <div className="absolute top-0 left-0 h-0 w-1 bg-linear-to-b from-[#3A8DFF] to-transparent transition-all duration-500 group-hover:h-full" />
            <div className="absolute inset-0 bg-linear-to-br from-[#3A8DFF]/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

            <div className="relative flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-[#3A8DFF] to-[#00D1FF] shadow-lg shadow-[#3A8DFF]/20 transition-all duration-500 group-hover:scale-105">
                <Users className="h-8 w-8 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="mb-1 text-lg font-bold text-white transition-colors duration-300 group-hover:text-[#3A8DFF]">
                  Peer-to-peer trading
                </h3>
                <p className="text-sm text-[#A3B8D9]/80">
                  Trade with other users, not against the platform.
                </p>
              </div>
            </div>
          </div>

          {/* Card 4 */}
          <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-linear-to-b from-white/[0.03] to-transparent p-6 backdrop-blur-xl transition-all duration-500 hover:border-[#00D1FF]/30 hover:bg-white/[0.05]">
            <div className="absolute top-0 left-0 h-0 w-1 bg-linear-to-b from-[#00D1FF] to-transparent transition-all duration-500 group-hover:h-full" />
            <div className="absolute inset-0 bg-linear-to-br from-[#00D1FF]/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

            <div className="relative flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-[#00D1FF] to-[#3A8DFF] shadow-lg shadow-[#00D1FF]/20 transition-all duration-500 group-hover:scale-105">
                <Zap className="h-8 w-8 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="mb-1 text-lg font-bold text-white transition-colors duration-300 group-hover:text-[#00D1FF]">
                  No synthetic pricing
                </h3>
                <p className="text-sm text-[#A3B8D9]/80">
                  Real orderbook matching without pooled liquidity mechanisms.
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-16 text-center text-xl font-medium text-[#A3B8D9]">
          You trade with other traders — not against the platform.
        </p>
      </div>
    </section>
  );
}
