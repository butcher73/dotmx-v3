import { Layout } from "@/components/common";
import Link from "next/link";

export default function OptionsPage() {
  return (
    <Layout>
      <div className="container mx-auto px-6 py-20">
        <div className="text-center">
          <div className="mx-auto max-w-4xl">
            <div className="rounded-3xl border border-[#23345C] bg-linear-to-r from-[#122347] to-[#1A2E57] p-16 shadow-2xl">
              <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-linear-to-br from-[#3A8DFF] to-[#00D1FF] shadow-lg">
                <span className="text-3xl font-bold text-white">⏳</span>
              </div>

              <h1 className="mb-8 text-5xl font-bold lg:text-6xl">
                <span className="gradient-text">Options Trading</span>
              </h1>

              <div className="mb-8 rounded-2xl border border-[#3A8DFF]/20 bg-linear-to-r from-[#3A8DFF]/10 to-[#00D1FF]/10 p-8">
                <h2 className="mb-4 text-3xl font-bold">
                  <span className="gradient-text-silver">Coming Soon</span>
                </h2>
                <p className="mx-auto mb-6 max-w-3xl text-xl text-[#A3B8D9]">
                  We&apos;re building advanced options trading capabilities with
                  sophisticated strategies and comprehensive risk management
                  tools.
                </p>
                <p className="text-lg text-[#A3B8D9]/80">
                  Stay tuned for updates on our options trading platform launch.
                </p>
              </div>

              <div className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="rounded-xl border border-[#23345C] bg-[#0A1733] p-6">
                  <h3 className="mb-2 text-lg font-bold">
                    <span className="gradient-text">Call & Put Options</span>
                  </h3>
                  <p className="text-sm text-[#A3B8D9]">
                    Trade both call and put options with multiple expiries
                  </p>
                </div>
                <div className="rounded-xl border border-[#23345C] bg-[#0A1733] p-6">
                  <h3 className="mb-2 text-lg font-bold">
                    <span className="gradient-text">Advanced Strategies</span>
                  </h3>
                  <p className="text-sm text-[#A3B8D9]">
                    Spreads, straddles, and complex multi-leg strategies
                  </p>
                </div>
                <div className="rounded-xl border border-[#23345C] bg-[#0A1733] p-6">
                  <h3 className="mb-2 text-lg font-bold">
                    <span className="gradient-text">Greeks Analytics</span>
                  </h3>
                  <p className="text-sm text-[#A3B8D9]">
                    Real-time Delta, Gamma, Theta, and Vega calculations
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <Link href="/trade" className="inline-block">
                  <div className="transform rounded-xl bg-linear-to-r from-[#3A8DFF] to-[#00D1FF] px-8 py-3 font-bold text-white transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-[#3A8DFF]/30">
                    Try Perp Trading Instead
                  </div>
                </Link>
                <div className="text-[#A3B8D9]">
                  or explore our{" "}
                  <Link
                    href="/portal/lp"
                    className="text-[#3A8DFF] transition-colors hover:text-[#00D1FF] hover:underline"
                  >
                    Liquidity Pools
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
