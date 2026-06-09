export default function HowItWorksSection() {
  return (
    <section className="py-32">
      <div className="container mx-auto px-6">
        <div className="mb-20 text-center">
          <h2 className="mb-8 text-4xl font-bold lg:text-5xl">
            <span className="gradient-text-silver">How DotMX Works</span>
          </h2>
        </div>

        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-16 lg:grid-cols-3 lg:gap-8">
            {/* Step 1 */}
            <div className="group text-center">
              <div className="relative mb-10">
                {/* Main circle with enhanced design */}
                <div className="relative mx-auto mb-6 h-32 w-32">
                  <div className="absolute inset-0 rounded-full bg-linear-to-br from-[#3A8DFF] via-[#00D1FF] to-[#1A2E57] shadow-2xl transition-all duration-700 group-hover:shadow-[#3A8DFF]/40"></div>
                  <div className="absolute inset-1 rounded-full bg-linear-to-br from-[#0A1733] to-[#122347]"></div>
                  <div className="absolute inset-3 flex items-center justify-center rounded-full bg-linear-to-br from-[#3A8DFF] to-[#00D1FF]">
                    <span className="text-4xl font-black text-white">1</span>
                  </div>

                  {/* Animated particles */}
                  <div className="absolute -inset-4">
                    <div className="absolute top-0 left-1/2 h-2 w-2 -translate-x-1/2 transform animate-ping rounded-full bg-[#3A8DFF] opacity-60"></div>
                    <div className="absolute right-0 bottom-0 h-1.5 w-1.5 animate-pulse rounded-full bg-[#00D1FF] opacity-40"></div>
                    <div className="absolute top-1/2 left-0 h-1 w-1 animate-bounce rounded-full bg-[#3A8DFF] opacity-50"></div>
                  </div>
                </div>

                {/* Step indicator */}
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#3A8DFF]/20 bg-[#3A8DFF]/10 px-4 py-2 backdrop-blur-sm">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#3A8DFF]"></div>
                  <span className="text-sm font-semibold text-[#3A8DFF]">
                    STEP ONE
                  </span>
                </div>
              </div>

              <h3 className="mb-6 text-3xl font-bold text-white transition-colors duration-300 group-hover:text-[#3A8DFF]">
                Orders execute at high speed
              </h3>
              <p className="mx-auto max-w-sm text-lg leading-relaxed text-[#A3B8D9]">
                Orders are matched in a purpose-built execution layer optimized
                for perpetual trading.
              </p>
            </div>

            {/* Step 2 */}
            <div className="group text-center">
              <div className="relative mb-10">
                {/* Main circle with enhanced design */}
                <div className="relative mx-auto mb-6 h-32 w-32">
                  <div className="absolute inset-0 rounded-full bg-linear-to-br from-[#3A8DFF] via-[#00D1FF] to-[#1A2E57] shadow-2xl transition-all duration-700 group-hover:shadow-[#3A8DFF]/40"></div>
                  <div className="absolute inset-1 rounded-full bg-linear-to-br from-[#0A1733] to-[#122347]"></div>
                  <div className="absolute inset-3 flex items-center justify-center rounded-full bg-linear-to-br from-[#3A8DFF] to-[#00D1FF]">
                    <span className="text-4xl font-black text-white">2</span>
                  </div>

                  {/* Animated particles */}
                  <div className="absolute -inset-4">
                    <div className="absolute top-0 right-0 h-2 w-2 animate-ping rounded-full bg-[#3A8DFF] opacity-60"></div>
                    <div className="absolute bottom-0 left-1/2 h-1.5 w-1.5 -translate-x-1/2 transform animate-pulse rounded-full bg-[#00D1FF] opacity-40"></div>
                    <div className="absolute top-1/2 right-0 h-1 w-1 translate-x-1/2 transform animate-bounce rounded-full bg-[#3A8DFF] opacity-50"></div>
                  </div>
                </div>

                {/* Step indicator */}
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#3A8DFF]/20 bg-[#3A8DFF]/10 px-4 py-2 backdrop-blur-sm">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#3A8DFF]"></div>
                  <span className="text-sm font-semibold text-[#3A8DFF]">
                    STEP TWO
                  </span>
                </div>
              </div>

              <h3 className="mb-6 text-3xl font-bold text-white transition-colors duration-300 group-hover:text-[#3A8DFF]">
                Positions update deterministically
              </h3>
              <p className="mx-auto max-w-sm text-lg leading-relaxed text-[#A3B8D9]">
                Trades update balances and positions according to predefined
                rules.
              </p>
            </div>

            {/* Step 3 */}
            <div className="group text-center">
              <div className="relative mb-10">
                {/* Main circle with enhanced design */}
                <div className="relative mx-auto mb-6 h-32 w-32">
                  <div className="absolute inset-0 rounded-full bg-linear-to-br from-[#3A8DFF] via-[#00D1FF] to-[#1A2E57] shadow-2xl transition-all duration-700 group-hover:shadow-[#3A8DFF]/40"></div>
                  <div className="absolute inset-1 rounded-full bg-linear-to-br from-[#0A1733] to-[#122347]"></div>
                  <div className="absolute inset-3 flex items-center justify-center rounded-full bg-linear-to-br from-[#3A8DFF] to-[#00D1FF]">
                    <span className="text-4xl font-black text-white">3</span>
                  </div>

                  {/* Animated particles */}
                  <div className="absolute -inset-4">
                    <div className="absolute top-0 left-0 h-2 w-2 animate-ping rounded-full bg-[#3A8DFF] opacity-60"></div>
                    <div className="absolute right-1/2 bottom-0 h-1.5 w-1.5 translate-x-1/2 transform animate-pulse rounded-full bg-[#00D1FF] opacity-40"></div>
                    <div className="absolute top-1/2 left-0 h-1 w-1 -translate-x-1/2 transform animate-bounce rounded-full bg-[#3A8DFF] opacity-50"></div>
                  </div>
                </div>

                {/* Step indicator */}
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#3A8DFF]/20 bg-[#3A8DFF]/10 px-4 py-2 backdrop-blur-sm">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#3A8DFF]"></div>
                  <span className="text-sm font-semibold text-[#3A8DFF]">
                    STEP THREE
                  </span>
                </div>
              </div>

              <h3 className="mb-6 text-3xl font-bold text-white transition-colors duration-300 group-hover:text-[#3A8DFF]">
                Settlement is verified on Ethereum
              </h3>
              <p className="mx-auto max-w-sm text-lg leading-relaxed text-[#A3B8D9]">
                State transitions are periodically proven using zero-knowledge
                proofs and finalized on Ethereum.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-20 text-center">
          <p className="text-xl font-medium text-white">
            Execution optimized for performance.
          </p>
          <p className="text-xl font-medium text-white">
            Settlement enforced by cryptography.
          </p>
        </div>
      </div>
    </section>
  );
}
