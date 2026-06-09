"use client";

import { Layout } from "@/components/common";
import { VolumeMetrics, VolumeChart } from "@/components/analytics";
import { BarChart3, TrendingUp, Target } from "lucide-react";

export default function AnalyticsPage() {
  return (
    <Layout>
      <div className="container mx-auto px-6 py-20">
        <div className="mb-16 text-center">
          <h1 className="mb-8 text-5xl font-bold lg:text-6xl">
            <span className="gradient-text">Analytics</span>
          </h1>
          <p className="mx-auto max-w-3xl text-xl leading-relaxed text-[#A3B8D9]">
            Comprehensive trading analytics and market insights to make informed
            decisions.
          </p>
        </div>

        <div className="mx-auto max-w-6xl">
          <div className="mb-16 grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="group rounded-3xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-8 shadow-2xl transition-all duration-300 hover:border-[#3A8DFF]">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-[#3A8DFF] to-[#00D1FF] shadow-lg transition-all duration-500 group-hover:shadow-[#3A8DFF]/30">
                <BarChart3 className="h-8 w-8 text-white" />
              </div>
              <h3 className="mb-4 text-2xl font-bold">
                <span className="gradient-text">Market Data</span>
              </h3>
              <p className="text-lg text-[#A3B8D9]">
                Real-time prices, volume analysis, and market depth across all
                perps.
              </p>
            </div>
            <div className="group rounded-3xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-8 shadow-2xl transition-all duration-300 hover:border-[#3A8DFF]">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-[#3A8DFF] to-[#00D1FF] shadow-lg transition-all duration-500 group-hover:shadow-[#3A8DFF]/30">
                <TrendingUp className="h-8 w-8 text-white" />
              </div>
              <h3 className="mb-4 text-2xl font-bold">
                <span className="gradient-text">Trading Insights</span>
              </h3>
              <p className="text-lg text-[#A3B8D9]">
                Advanced charting tools, technical indicators, and performance
                analytics.
              </p>
            </div>
            <div className="group rounded-3xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-8 shadow-2xl transition-all duration-300 hover:border-[#3A8DFF]">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-[#3A8DFF] to-[#00D1FF] shadow-lg transition-all duration-500 group-hover:shadow-[#3A8DFF]/30">
                <Target className="h-8 w-8 text-white" />
              </div>
              <h3 className="mb-4 text-2xl font-bold">
                <span className="gradient-text">Portfolio Tracking</span>
              </h3>
              <p className="text-lg text-[#A3B8D9]">
                Monitor your trading performance and portfolio allocation in
                real-time.
              </p>
            </div>
          </div>

          {/* Trading Volume Analytics */}
          <div className="mb-12 space-y-8">
            <div className="text-center">
              <h2 className="mb-4 text-4xl font-bold">
                <span className="gradient-text">Trading Volume Analytics</span>
              </h2>
              <p className="mx-auto max-w-3xl text-xl text-[#A3B8D9]">
                Real-time trading volume data and insights from DotMX protocol
                transactions
              </p>
            </div>

            {/* Volume Metrics */}
            <VolumeMetrics />

            {/* Volume Chart */}
            <VolumeChart height={400} />
          </div>

          {/* Future Features */}
          <div className="mb-12 rounded-3xl border border-[#23345C] bg-linear-to-r from-[#122347] to-[#1A2E57] p-12 shadow-2xl">
            <h2 className="mb-8 text-center text-4xl font-bold">
              <span className="gradient-text-silver">Coming Soon</span>
            </h2>
            <div className="mb-8 text-center">
              <p className="mx-auto mb-6 max-w-4xl text-xl text-[#A3B8D9]">
                Advanced analytics dashboard with comprehensive market insights
                and trading intelligence.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              <div>
                <h4 className="mb-4 text-xl font-bold text-white">
                  Advanced Analytics
                </h4>
                <ul className="space-y-2 text-[#A3B8D9]">
                  <li>• Real-time price feeds and charts</li>
                  <li>• Liquidity analysis and depth visualization</li>
                  <li>• Historical data and trend analysis</li>
                  <li>• Cross-market arbitrage opportunities</li>
                </ul>
              </div>
              <div>
                <h4 className="mb-4 text-xl font-bold text-white">
                  Trading Tools
                </h4>
                <ul className="space-y-2 text-[#A3B8D9]">
                  <li>• Technical indicators (RSI, MACD, etc.)</li>
                  <li>• Custom chart overlays and alerts</li>
                  <li>• Performance attribution analysis</li>
                  <li>• Risk management dashboards</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
