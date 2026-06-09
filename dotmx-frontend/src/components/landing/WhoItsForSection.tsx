export default function WhoItsForSection() {
  return (
    <section className="border-t border-gray-800 py-32">
      <div className="container mx-auto px-6">
        <div className="mb-16 text-center">
          <h2 className="mb-12 text-4xl font-bold text-white lg:text-5xl">
            Who DotMX Is For
          </h2>
        </div>

        <div className="mx-auto max-w-3xl space-y-6">
          <div className="flex items-start">
            <span className="mr-4 text-lg text-gray-400">•</span>
            <p className="text-lg text-gray-300">
              <strong className="text-white">Active traders</strong> who need
              speed and precision
            </p>
          </div>
          <div className="flex items-start">
            <span className="mr-4 text-lg text-gray-400">•</span>
            <p className="text-lg text-gray-300">
              <strong className="text-white">Professional traders</strong> who
              care about execution quality
            </p>
          </div>
          <div className="flex items-start">
            <span className="mr-4 text-lg text-gray-400">•</span>
            <p className="text-lg text-gray-300">
              <strong className="text-white">Crypto-native users</strong> who
              value cryptographic guarantees
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
