import { Zap, Lock, BarChart3 } from "lucide-react";

export default function HighlightsSection() {
  return (
    <section className="py-32">
      <div className="container mx-auto px-6">
        <div className="mb-24 text-center">
          <h2 className="mb-16 text-5xl font-bold lg:text-6xl">
            <span className="gradient-text-silver">Why DotMX</span>
          </h2>
          <h3 className="text-2xl font-bold text-white">
            No blind trust. No artificial constraints.
          </h3>
        </div>

        {/* Two column layout */}
        <div className="grid grid-cols-1 gap-20 md:grid-cols-2 lg:gap-28">
          {/* Left side - Text content */}
          <div className="flex flex-col justify-start">
            <p className="mb-10 text-3xl font-semibold text-white">
              Every trading platform forces a choice:
            </p>
            <div className="mb-16 space-y-4 text-xl text-[#A3B8D9]">
              <p>Speed or transparency</p>
              <p>Performance or security</p>
            </div>
            <p className="text-3xl font-bold text-white">
              DotMX delivers{" "}
              <span className="bg-linear-to-r from-[#3A8DFF] to-[#00D1FF] bg-clip-text text-transparent">
                both.
              </span>
            </p>
          </div>

          {/* Right side - Three cards stacked */}
          <div className="flex flex-col gap-8">
            {/* Card 1 */}
            <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-linear-to-b from-white/[0.03] to-transparent p-6 backdrop-blur-xl transition-all duration-500 hover:border-[#3A8DFF]/30 hover:bg-white/[0.05]">
              <div className="absolute top-0 left-0 h-0 w-1 bg-linear-to-b from-[#3A8DFF] to-transparent transition-all duration-500 group-hover:h-full" />
              <div className="absolute inset-0 bg-linear-to-br from-[#3A8DFF]/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

              <div className="relative flex items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-[#3A8DFF] to-[#00D1FF] shadow-lg shadow-[#3A8DFF]/20 transition-all duration-500 group-hover:scale-105">
                  <Zap className="h-8 w-8 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="mb-1 text-lg font-bold text-white transition-colors duration-300 group-hover:text-[#3A8DFF]">
                    High-throughput orderbook execution
                  </h3>
                  <p className="text-sm text-[#A3B8D9]/80">
                    Orders matched instantly in a purpose-built execution layer.
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
                  <Lock className="h-8 w-8 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="mb-1 text-lg font-bold text-white transition-colors duration-300 group-hover:text-[#00D1FF]">
                    Zero-knowledge verified settlement
                  </h3>
                  <p className="text-sm text-[#A3B8D9]/80">
                    Settlement correctness cryptographically proven on Ethereum.
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
                  <BarChart3 className="h-8 w-8 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="mb-1 text-lg font-bold text-white transition-colors duration-300 group-hover:text-[#3A8DFF]">
                    Ethereum Layer 2 security model
                  </h3>
                  <p className="text-sm text-[#A3B8D9]/80">
                    Execution optimized for speed backed by Ethereum security.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
