export default function WhatMakesDifferentSection() {
  return (
    <section className="border-t border-gray-800 py-32">
      <div className="container mx-auto px-6">
        <div className="mb-16 text-center">
          <h2 className="mb-12 text-4xl font-bold text-white lg:text-5xl">
            What Makes DotMX Different
          </h2>
        </div>

        <div className="mx-auto max-w-4xl space-y-12">
          <div>
            <h3 className="mb-4 text-2xl font-bold text-white">
              • Execution Layer Architecture
            </h3>
            <p className="ml-6 text-lg text-gray-400">
              Built specifically for speed, not general-purpose blockspace.
            </p>
          </div>

          <div>
            <h3 className="mb-4 text-2xl font-bold text-white">
              • Zero-Knowledge Security Model
            </h3>
            <p className="ml-6 text-lg text-gray-400">
              Settlement correctness is cryptographically proven.
            </p>
          </div>

          <div>
            <h3 className="mb-4 text-2xl font-bold text-white">
              • No House Trading
            </h3>
            <p className="ml-6 text-lg text-gray-400">
              DotMX does not take directional positions.
            </p>
          </div>

          <div>
            <h3 className="mb-4 text-2xl font-bold text-white">
              • Designed for Active Traders
            </h3>
            <p className="ml-6 text-lg text-gray-400">
              Tight spreads, fast cancels, stable execution under load.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
