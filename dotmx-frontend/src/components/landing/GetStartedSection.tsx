import Link from "next/link";
import { Button } from "@/components/ui";

export default function GetStartedSection() {
  return (
    <section className="border-t border-gray-800 py-32">
      <div className="container mx-auto px-6">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-8 text-4xl font-bold text-white lg:text-5xl">
            Get Started
          </h2>
          <p className="mb-12 text-xl leading-relaxed text-gray-300">
            Trade perpetuals on an execution layer built for performance
            <br />
            and secured by zero-knowledge proofs.
          </p>
          <div className="flex flex-col justify-center space-y-4 sm:flex-row sm:space-y-0 sm:space-x-6">
            <Link href="/trade">
              <Button variant="primary" size="lg">
                Start Trading
              </Button>
            </Link>
            <Link href="/docs">
              <Button variant="outline" size="lg">
                Read the Architecture
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
