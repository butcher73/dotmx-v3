import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui";

export default function HeroSection() {
  return (
    <section className="container mx-auto px-6 py-32">
      <div className="flex flex-col items-center justify-between gap-16 lg:flex-row">
        <div className="mb-12 lg:mb-0 lg:w-1/2">
          <h1 className="mb-8 text-5xl leading-tight font-bold lg:text-7xl">
            <span className="gradient-text">DotMX</span>
          </h1>
          <div className="mb-10">
            <p className="mb-2 text-xl leading-relaxed text-[#A3B8D9] lg:text-2xl">
              <span className="text-[#00D1FF]">Ethereum Layer 2</span> Perpetual
              Trading
            </p>
            <p className="text-xl leading-relaxed text-[#A3B8D9] lg:text-2xl">
              High-Throughput Execution Secured by{" "}
              <span className="font-semibold text-[#3A8DFF]">
                Zero-Knowledge Proofs
              </span>
            </p>
          </div>
          <p className="mb-12 max-w-2xl text-lg leading-relaxed text-[#A3B8D9]">
            DotMX is an Ethereum Layer 2 execution layer for perpetuals, secured
            by zero-knowledge proofs.
          </p>
          <p className="mb-12 max-w-2xl text-lg leading-relaxed text-white">
            Trade with professional-grade speed, while settlement correctness is
            cryptographically verified on Ethereum.
          </p>
          <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-6">
            <Link href="/trade">
              <Button variant="primary" size="lg">
                Start Trading
              </Button>
            </Link>
            <Link href="/docs">
              <Button variant="outline" size="lg">
                Learn How It Works
              </Button>
            </Link>
          </div>
        </div>
        <div className="flex justify-center lg:w-1/2">
          <div className="relative h-96 w-full max-w-2xl">
            {/* Phone with trading chart - positioned on the left */}
            <div className="animate-float-slow absolute top-8 left-8 z-15">
              <div className="relative">
                <Image
                  src="/img/phone.png"
                  alt="Mobile Trading Chart"
                  width={120}
                  height={120}
                  unoptimized
                  className="h-auto w-28 object-contain filter"
                />
              </div>
            </div>

            {/* Central bank/institution building on platform */}
            <div className="absolute top-1/2 left-1/2 z-20 -translate-x-1/2 -translate-y-1/2 transform">
              <div className="relative">
                <Image
                  src="/img/bank.png"
                  alt="Financial Institution"
                  width={350}
                  height={350}
                  priority
                  unoptimized
                  className="object-contain filter"
                />
              </div>
            </div>

            {/* Crypto bubble/label - positioned between bank and mobile */}
            <div className="animate-float-delayed absolute top-12 left-1/3 z-15 -translate-x-1/2 transform">
              <Image
                src="/img/bubble.png"
                alt="Crypto"
                width={70}
                height={70}
                unoptimized
                className="h-18 w-auto object-contain opacity-90"
              />
            </div>

            {/* Background glow effects for depth */}
            <div className="absolute inset-0 rounded-full bg-linear-to-br from-[#3A8DFF]/5 via-transparent to-[#00D1FF]/5 blur-3xl"></div>
            <div className="absolute bottom-0 left-1/2 h-20 w-80 -translate-x-1/2 transform rounded-full bg-[#3A8DFF]/5 blur-xl"></div>
          </div>
        </div>
      </div>
    </section>
  );
}
