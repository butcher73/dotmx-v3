import { Layout } from "@/components/common";
import { Lock, Eye } from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <Layout>
      <div className="container mx-auto max-w-4xl px-6 py-20">
        <div className="mb-16 text-center">
          <h1 className="mb-8 text-5xl font-bold lg:text-6xl">
            <span className="gradient-text">Privacy Policy</span>
          </h1>
          <p className="text-xl leading-relaxed text-[#A3B8D9]">
            Last updated: Coming Soon
          </p>
        </div>

        <div className="mb-12 rounded-3xl border border-[#23345C] bg-linear-to-r from-[#122347] to-[#1A2E57] p-12 shadow-2xl">
          <h2 className="mb-8 text-center text-4xl font-bold">
            <span className="gradient-text-silver">
              Privacy Policy - Coming Soon
            </span>
          </h2>
          <div className="mb-8 text-center">
            <p className="mb-6 text-xl text-[#A3B8D9]">
              We&apos;re preparing comprehensive privacy documentation to ensure
              transparency about how we handle your data.
            </p>
          </div>

          <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-[#3A8DFF] to-[#00D1FF] shadow-lg">
                <Lock className="h-8 w-8 text-white" />
              </div>
              <h4 className="mb-2 text-xl font-bold text-white">
                Data Protection
              </h4>
              <p className="text-[#A3B8D9]">
                Your personal and trading data is secured with industry-leading
                encryption
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-[#3A8DFF] to-[#00D1FF] shadow-lg">
                <Eye className="h-8 w-8 text-white" />
              </div>
              <h4 className="mb-2 text-xl font-bold text-white">
                Transparency
              </h4>
              <p className="text-[#A3B8D9]">
                Clear information about what data we collect and how it&apos;s
                used
              </p>
            </div>
          </div>
        </div>

        <div className="prose prose-invert max-w-none">
          <div className="mb-8 rounded-3xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-8 shadow-2xl">
            <h3 className="mb-4 text-2xl font-bold">
              <span className="gradient-text">Our Commitment to Privacy</span>
            </h3>
            <p className="mb-4 text-[#A3B8D9]">
              At dotmx, we are committed to protecting your privacy and ensuring
              the security of your personal information. Our comprehensive
              privacy policy will cover:
            </p>
            <ul className="space-y-2 text-[#A3B8D9]">
              <li>• Information we collect and why</li>
              <li>• How we use and protect your data</li>
              <li>• Your rights and choices</li>
              <li>• Data sharing and third-party services</li>
              <li>• Security measures and protocols</li>
              <li>• Compliance with global privacy regulations</li>
            </ul>
          </div>

          <div className="mb-8 rounded-3xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-8 shadow-2xl">
            <h3 className="mb-4 text-2xl font-bold">
              <span className="gradient-text">Key Privacy Principles</span>
            </h3>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <h4 className="mb-2 text-lg font-bold text-white">
                  Minimal Data Collection
                </h4>
                <p className="text-[#A3B8D9]">
                  We only collect data necessary for platform functionality and
                  security.
                </p>
              </div>
              <div>
                <h4 className="mb-2 text-lg font-bold text-white">
                  User Control
                </h4>
                <p className="text-[#A3B8D9]">
                  You maintain control over your personal information and
                  privacy settings.
                </p>
              </div>
              <div>
                <h4 className="mb-2 text-lg font-bold text-white">
                  Secure Storage
                </h4>
                <p className="text-[#A3B8D9]">
                  All data is encrypted and stored using industry-standard
                  security practices.
                </p>
              </div>
              <div>
                <h4 className="mb-2 text-lg font-bold text-white">
                  No Sale of Data
                </h4>
                <p className="text-[#A3B8D9]">
                  We never sell your personal information to third parties.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-8 shadow-2xl">
            <h3 className="mb-4 text-2xl font-bold">
              <span className="gradient-text">Questions About Privacy?</span>
            </h3>
            <p className="mb-4 text-[#A3B8D9]">
              If you have any questions about our privacy practices or would
              like to learn more about how we protect your data, please contact
              our privacy team at:
            </p>
            <p className="font-semibold text-white">privacy@dotmx.com</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
