import { Check } from "lucide-react";

export default function TransparencySafetySection() {
  return (
    <section className="border-t border-gray-800 py-32">
      <div className="container mx-auto px-6">
        <div className="mb-16 text-center">
          <h2 className="mb-12 text-4xl font-bold text-white lg:text-5xl">
            Transparency & Safety
          </h2>
        </div>

        <div className="mx-auto max-w-3xl space-y-6">
          <div className="flex items-start">
            <Check className="mt-1 mr-4 h-6 w-6 shrink-0 text-white" />
            <p className="text-lg text-gray-300">Users trade with users</p>
          </div>
          <div className="flex items-start">
            <Check className="mt-1 mr-4 h-6 w-6 shrink-0 text-white" />
            <p className="text-lg text-gray-300">
              No hidden balance manipulation
            </p>
          </div>
          <div className="flex items-start">
            <Check className="mt-1 mr-4 h-6 w-6 shrink-0 text-white" />
            <p className="text-lg text-gray-300">
              Deterministic rules for PnL, funding, and liquidations
            </p>
          </div>
          <div className="flex items-start">
            <Check className="mt-1 mr-4 h-6 w-6 shrink-0 text-white" />
            <p className="text-lg text-gray-300">
              Zero-knowledge proofs verify settlement correctness
            </p>
          </div>
        </div>

        <p className="mt-16 text-center text-xl font-medium text-gray-300">
          You don&apos;t have to trust claims — the system is designed to be
          verifiable.
        </p>
      </div>
    </section>
  );
}
