import { Zap, Shield, Cpu } from "lucide-react";

export default function FAQSection() {
  return (
    <section className="py-32">
      <div className="container mx-auto px-6">
        <div className="mb-20 text-center">
          <h2 className="mb-8 text-4xl font-bold lg:text-5xl">
            <span className="gradient-text-silver">Transparency & Safety</span>
          </h2>
        </div>
        <div className="mx-auto mb-16 max-w-4xl space-y-4">
          <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-linear-to-b from-white/[0.03] to-transparent p-8 backdrop-blur-xl transition-all duration-300 hover:border-[#3A8DFF]/20">
            <div className="absolute inset-0 bg-linear-to-br from-[#3A8DFF]/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="relative">
              <p className="text-lg leading-relaxed text-white">
                ✔ Users trade with users
              </p>
            </div>
          </div>
          <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-linear-to-b from-white/[0.03] to-transparent p-8 backdrop-blur-xl transition-all duration-300 hover:border-[#00D1FF]/20">
            <div className="absolute inset-0 bg-linear-to-br from-[#00D1FF]/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="relative">
              <p className="text-lg leading-relaxed text-white">
                ✔ Deterministic rules for funding, PnL, and liquidations
              </p>
            </div>
          </div>
          <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-linear-to-b from-white/[0.03] to-transparent p-8 backdrop-blur-xl transition-all duration-300 hover:border-[#3A8DFF]/20">
            <div className="absolute inset-0 bg-linear-to-br from-[#3A8DFF]/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="relative">
              <p className="text-lg leading-relaxed text-white">
                ✔ No hidden house positions
              </p>
            </div>
          </div>
          <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-linear-to-b from-white/[0.03] to-transparent p-8 backdrop-blur-xl transition-all duration-300 hover:border-[#00D1FF]/20">
            <div className="absolute inset-0 bg-linear-to-br from-[#00D1FF]/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="relative">
              <p className="text-lg leading-relaxed text-white">
                ✔ Zero-knowledge proofs verify settlement correctness
              </p>
            </div>
          </div>
          <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-linear-to-b from-white/[0.03] to-transparent p-8 backdrop-blur-xl transition-all duration-300 hover:border-[#3A8DFF]/20">
            <div className="absolute inset-0 bg-linear-to-br from-[#3A8DFF]/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="relative">
              <p className="text-lg leading-relaxed text-white">
                ✔ Settlement finalized on Ethereum
              </p>
            </div>
          </div>
        </div>
        <p className="mb-32 text-center text-xl font-medium text-[#A3B8D9]">
          Trust is minimized by design.
        </p>

        <div className="mb-32 text-center">
          <h2 className="mb-16 text-5xl font-bold lg:text-6xl">
            <span className="gradient-text-silver">Who DotMX Is For</span>
          </h2>
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
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
                    Active traders
                  </h3>
                  <p className="text-sm text-[#A3B8D9]/80">
                    Demand execution quality and orderbook-based matching.
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
                  <Shield className="h-8 w-8 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="mb-1 text-lg font-bold text-white transition-colors duration-300 group-hover:text-[#00D1FF]">
                    Professional users
                  </h3>
                  <p className="text-sm text-[#A3B8D9]/80">
                    Value transparent settlement and deterministic rules.
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
                  <Cpu className="h-8 w-8 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="mb-1 text-lg font-bold text-white transition-colors duration-300 group-hover:text-[#3A8DFF]">
                    Crypto-native traders
                  </h3>
                  <p className="text-sm text-[#A3B8D9]/80">
                    Prefer Ethereum-based security and Layer 2 benefits.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-20 text-center">
          <h2 className="mb-8 text-4xl font-bold lg:text-5xl">
            <span className="gradient-text-silver">Get Started</span>
          </h2>
          <p className="mx-auto mb-12 max-w-3xl text-xl leading-relaxed text-[#A3B8D9]">
            Trade perpetuals on an Ethereum Layer 2 execution layer secured by
            zero-knowledge proofs.
          </p>
          <div className="flex flex-col justify-center space-y-4 sm:flex-row sm:space-y-0 sm:space-x-6">
            <a
              href="/trade"
              className="inline-block rounded-xl bg-linear-to-r from-[#3A8DFF] to-[#00D1FF] px-8 py-4 text-lg font-semibold text-white transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-[#3A8DFF]/30"
            >
              Start Trading
            </a>
            <a
              href="/docs"
              className="inline-block rounded-xl border-2 border-[#3A8DFF] px-8 py-4 text-lg font-semibold text-[#3A8DFF] transition-all duration-300 hover:bg-[#3A8DFF]/10"
            >
              Read the Architecture
            </a>
          </div>
        </div>

        <div className="border-t border-white/5 pt-16 text-center">
          <h3 className="mb-6 text-2xl font-bold text-white">
            Risk Disclosure
          </h3>
          <p className="mx-auto max-w-3xl text-base leading-relaxed text-[#A3B8D9]/80">
            Perpetual trading involves significant risk and may not be suitable
            for all users.
          </p>
        </div>
      </div>
    </section>
  );
}
