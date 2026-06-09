import { Layout } from "@/components/common";

export default function APIPage() {
  return (
    <Layout>
      <div className="container mx-auto px-6 py-20">
        <div className="mb-16 text-center">
          <h1 className="mb-8 text-5xl font-bold lg:text-6xl">
            <span className="gradient-text">API</span>
          </h1>
          <p className="mx-auto max-w-3xl text-xl leading-relaxed text-[#A3B8D9]">
            Integrate dotmx trading capabilities into your applications with our
            powerful REST and WebSocket APIs.
          </p>
        </div>

        <div className="mx-auto max-w-6xl">
          <div className="mb-16 grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="group rounded-3xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-8 shadow-2xl transition-all duration-300 hover:border-[#3A8DFF]">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-[#3A8DFF] to-[#00D1FF] shadow-lg transition-all duration-500 group-hover:shadow-[#3A8DFF]/30">
                <span className="text-xl font-bold text-white">🔌</span>
              </div>
              <h3 className="mb-4 text-2xl font-bold">
                <span className="gradient-text">REST API</span>
              </h3>
              <p className="text-lg text-[#A3B8D9]">
                Full REST API for trading, market data, and account management
                with comprehensive documentation.
              </p>
            </div>
            <div className="group rounded-3xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-8 shadow-2xl transition-all duration-300 hover:border-[#3A8DFF]">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-[#3A8DFF] to-[#00D1FF] shadow-lg transition-all duration-500 group-hover:shadow-[#3A8DFF]/30">
                <span className="text-xl font-bold text-white">⚡</span>
              </div>
              <h3 className="mb-4 text-2xl font-bold">
                <span className="gradient-text">WebSocket</span>
              </h3>
              <p className="text-lg text-[#A3B8D9]">
                Real-time market data feeds and order updates via WebSocket
                connections.
              </p>
            </div>
            <div className="group rounded-3xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-8 shadow-2xl transition-all duration-300 hover:border-[#3A8DFF]">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-[#3A8DFF] to-[#00D1FF] shadow-lg transition-all duration-500 group-hover:shadow-[#3A8DFF]/30">
                <span className="text-xl font-bold text-white">🛡️</span>
              </div>
              <h3 className="mb-4 text-2xl font-bold">
                <span className="gradient-text">Secure</span>
              </h3>
              <p className="text-lg text-[#A3B8D9]">
                API key management with rate limiting and comprehensive security
                measures.
              </p>
            </div>
          </div>

          <div className="mb-12 rounded-3xl border border-[#23345C] bg-linear-to-r from-[#122347] to-[#1A2E57] p-12 shadow-2xl">
            <h2 className="mb-8 text-center text-4xl font-bold">
              <span className="gradient-text-silver">
                API Documentation - Coming Soon
              </span>
            </h2>
            <div className="mb-8 text-center">
              <p className="mx-auto mb-6 max-w-4xl text-xl text-[#A3B8D9]">
                Comprehensive API suite for developers to integrate dotmx
                trading functionality into their applications.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              <div>
                <h4 className="mb-4 text-xl font-bold text-white">
                  Trading API
                </h4>
                <ul className="space-y-2 text-[#A3B8D9]">
                  <li>• Place and manage orders</li>
                  <li>• Portfolio and balance queries</li>
                  <li>• Trade history and analytics</li>
                  <li>• Account management</li>
                </ul>
              </div>
              <div>
                <h4 className="mb-4 text-xl font-bold text-white">
                  Market Data API
                </h4>
                <ul className="space-y-2 text-[#A3B8D9]">
                  <li>• Real-time price feeds</li>
                  <li>• Order book data</li>
                  <li>• Historical OHLCV data</li>
                  <li>• Volume and liquidity metrics</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="rounded-3xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-8 shadow-2xl">
              <h3 className="mb-6 text-2xl font-bold">
                <span className="gradient-text">Getting Started</span>
              </h3>
              <ol className="space-y-3 text-[#A3B8D9]">
                <li>1. Create API credentials</li>
                <li>2. Review documentation</li>
                <li>3. Test in sandbox environment</li>
                <li>4. Deploy to production</li>
              </ol>
            </div>
            <div className="rounded-3xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-8 shadow-2xl">
              <h3 className="mb-6 text-2xl font-bold">
                <span className="gradient-text">Use Cases</span>
              </h3>
              <ul className="space-y-3 text-[#A3B8D9]">
                <li>• Algorithmic trading bots</li>
                <li>• Portfolio management tools</li>
                <li>• Custom trading interfaces</li>
                <li>• Market data analysis</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
