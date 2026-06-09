export default function MetricsSection() {
  return (
    <section className="border-t border-white/10 py-24">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-2 gap-12 md:grid-cols-4">
          {/* Metric 1 */}
          <div className="text-center">
            <div className="mb-4 text-5xl font-bold text-white lg:text-6xl">
              <span className="bg-linear-to-r from-[#3A8DFF] to-[#00D1FF] bg-clip-text text-transparent">
                &lt; 1 ms
              </span>
            </div>
            <p className="text-lg text-[#A3B8D9]">Execution latency</p>
          </div>

          {/* Metric 2 */}
          <div className="text-center">
            <div className="mb-4 text-5xl font-bold text-white lg:text-6xl">
              <span className="bg-linear-to-r from-[#00D1FF] to-[#3A8DFF] bg-clip-text text-transparent">
                100,000+
              </span>
            </div>
            <p className="text-lg text-[#A3B8D9]">Orders/sec per market</p>
          </div>

          {/* Metric 3 */}
          <div className="text-center">
            <div className="mb-4 text-5xl font-bold text-white lg:text-6xl">
              <span className="bg-linear-to-r from-[#3A8DFF] to-[#00D1FF] bg-clip-text text-transparent">
                Hourly
              </span>
            </div>
            <p className="text-lg text-[#A3B8D9]">ZK settlement proofs</p>
          </div>

          {/* Metric 4 */}
          <div className="text-center">
            <div className="mb-4 text-5xl font-bold text-white lg:text-6xl">
              <span className="bg-linear-to-r from-[#00D1FF] to-[#3A8DFF] bg-clip-text text-transparent">
                Ethereum
              </span>
            </div>
            <p className="text-lg text-[#A3B8D9]">Layer 2 settlement</p>
          </div>
        </div>
      </div>
    </section>
  );
}
