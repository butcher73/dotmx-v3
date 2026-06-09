import { Layout } from "@/components/common";
import { Target, Lock, Zap } from "lucide-react";

export default function AboutPage() {
  return (
    <Layout>
      <div className="container mx-auto px-6 py-20">
        <div className="mb-16 text-center">
          <h1 className="mb-8 text-5xl font-bold lg:text-6xl">
            <span className="gradient-text">About dotmx</span>
          </h1>
          <p className="mx-auto max-w-3xl text-xl leading-relaxed text-[#A3B8D9]">
            Bridging the gap between centralized and decentralized trading with
            a familiar interface and complete asset control.
          </p>
        </div>

        <div className="mx-auto max-w-5xl">
          <div className="mb-20 grid grid-cols-1 gap-16 lg:grid-cols-2">
            <div>
              <h2 className="mb-8 text-3xl font-bold">
                <span className="gradient-text-silver">Our Mission</span>
              </h2>
              <p className="mb-6 text-lg leading-relaxed text-[#A3B8D9]">
                dotmx is revolutionizing crypto trading by combining the
                familiar user experience of centralized exchanges with the
                security and transparency of decentralized finance.
              </p>
              <p className="mb-6 text-lg leading-relaxed text-[#A3B8D9]">
                We believe that traders shouldn&apos;t have to choose between
                usability and self-custody. Our platform provides a seamless
                trading experience while ensuring you maintain complete control
                over your assets.
              </p>
              <p className="text-lg leading-relaxed text-[#A3B8D9]">
                Built exclusively on BSC (Binance Smart Chain) and powered by
                PancakeSwap&apos;s liquidity, dotmx offers deep liquidity,
                transparent pricing, and the security of non-custodial trading
                on the most liquid network.
              </p>
            </div>
            <div className="rounded-3xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-10 shadow-2xl">
              <h3 className="mb-8 text-center text-2xl font-bold">
                <span className="gradient-text">Key Principles</span>
              </h3>
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br from-[#3A8DFF] to-[#00D1FF] font-bold text-white shadow-lg">
                    1
                  </div>
                  <div>
                    <h4 className="mb-2 font-semibold text-white">
                      Non-Custodial
                    </h4>
                    <p className="text-[#A3B8D9]">
                      Your assets, your keys, your control. Always.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br from-[#3A8DFF] to-[#00D1FF] font-bold text-white shadow-lg">
                    2
                  </div>
                  <div>
                    <h4 className="mb-2 font-semibold text-white">
                      Transparent
                    </h4>
                    <p className="text-[#A3B8D9]">
                      Open-source smart contracts and clear fee structures.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br from-[#3A8DFF] to-[#00D1FF] font-bold text-white shadow-lg">
                    3
                  </div>
                  <div>
                    <h4 className="mb-2 font-semibold text-white">
                      Accessible
                    </h4>
                    <p className="text-[#A3B8D9]">
                      Familiar interface for traders of all experience levels.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br from-[#3A8DFF] to-[#00D1FF] font-bold text-white shadow-lg">
                    4
                  </div>
                  <div>
                    <h4 className="mb-2 font-semibold text-white">
                      Innovative
                    </h4>
                    <p className="text-[#A3B8D9]">
                      Pushing the boundaries of DeFi trading technology.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-16 rounded-3xl border border-[#23345C] bg-linear-to-r from-[#122347] to-[#1A2E57] p-12 shadow-2xl">
            <h2 className="mb-12 text-center text-4xl font-bold">
              <span className="gradient-text-silver">
                What Makes Us Different
              </span>
            </h2>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              <div className="text-center">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-linear-to-br from-[#3A8DFF] to-[#00D1FF] shadow-2xl">
                  <Target className="h-10 w-10 text-white" />
                </div>
                <h3 className="mb-4 text-xl font-bold text-white">
                  CEX-Like Experience
                </h3>
                <p className="text-[#A3B8D9]">
                  Familiar order books, charts, and trading tools that
                  professional traders expect.
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-linear-to-br from-[#3A8DFF] to-[#00D1FF] shadow-2xl">
                  <Lock className="h-10 w-10 text-white" />
                </div>
                <h3 className="mb-4 text-xl font-bold text-white">
                  DEX Security
                </h3>
                <p className="text-[#A3B8D9]">
                  Trade directly from your wallet with smart contract execution
                  and transparent settlement.
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-linear-to-br from-[#3A8DFF] to-[#00D1FF] shadow-2xl">
                  <Zap className="h-10 w-10 text-white" />
                </div>
                <h3 className="mb-4 text-xl font-bold text-white">
                  Deep Liquidity
                </h3>
                <p className="text-[#A3B8D9]">
                  Access PancakeSwap&apos;s deep liquidity pools on BSC for
                  optimal pricing and minimal slippage on the fastest network.
                </p>
              </div>
            </div>
          </div>

          <div className="text-center">
            <h2 className="mb-8 text-4xl font-bold">
              <span className="gradient-text">Join the Future of Trading</span>
            </h2>
            <p className="mx-auto mb-12 max-w-4xl text-xl text-[#A3B8D9]">
              Experience the best of both worlds - the usability of centralized
              exchanges with the security and transparency of decentralized
              finance.
            </p>
            <div className="inline-block rounded-2xl border border-[#3A8DFF]/20 bg-linear-to-r from-[#3A8DFF]/10 to-[#00D1FF]/10 p-8">
              <div className="mb-2 text-3xl font-bold text-[#3A8DFF]">
                Non-Custodial Trading
              </div>
              <div className="text-[#A3B8D9]">
                Your assets never leave your wallet
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
