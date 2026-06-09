import { Layout } from "@/components/common";
import { Scale, FileText, AlertTriangle } from "lucide-react";

export default function TermsPage() {
  return (
    <Layout>
      <div className="container mx-auto max-w-4xl px-6 py-20">
        <div className="mb-16 text-center">
          <h1 className="mb-8 text-5xl font-bold lg:text-6xl">
            <span className="gradient-text">Terms of Service</span>
          </h1>
          <p className="text-xl leading-relaxed text-[#A3B8D9]">
            Last updated: Coming Soon
          </p>
        </div>

        <div className="mb-12 rounded-3xl border border-[#23345C] bg-linear-to-r from-[#122347] to-[#1A2E57] p-12 shadow-2xl">
          <h2 className="mb-8 text-center text-4xl font-bold">
            <span className="gradient-text-silver">
              Terms of Service - Coming Soon
            </span>
          </h2>
          <div className="mb-8 text-center">
            <p className="mb-6 text-xl text-[#A3B8D9]">
              We&apos;re preparing comprehensive terms of service to clearly
              outline the rights and responsibilities of using dotmx.
            </p>
          </div>

          <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-[#3A8DFF] to-[#00D1FF] shadow-lg">
                <Scale className="h-8 w-8 text-white" />
              </div>
              <h4 className="mb-2 text-xl font-bold text-white">Fair Terms</h4>
              <p className="text-[#A3B8D9]">
                Clear, fair, and transparent terms that protect both users and
                the platform
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-[#3A8DFF] to-[#00D1FF] shadow-lg">
                <FileText className="h-8 w-8 text-white" />
              </div>
              <h4 className="mb-2 text-xl font-bold text-white">Compliance</h4>
              <p className="text-[#A3B8D9]">
                Terms that comply with global regulations and best practices
              </p>
            </div>
          </div>
        </div>

        <div className="prose prose-invert max-w-none">
          <div className="mb-8 rounded-3xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-8 shadow-2xl">
            <h3 className="mb-4 text-2xl font-bold">
              <span className="gradient-text">What Our Terms Will Cover</span>
            </h3>
            <p className="mb-4 text-[#A3B8D9]">
              Our comprehensive terms of service will clearly outline:
            </p>
            <ul className="space-y-2 text-[#A3B8D9]">
              <li>• Platform usage rights and restrictions</li>
              <li>• Trading rules and risk disclosures</li>
              <li>• Account responsibilities and security</li>
              <li>• Fee structure and payment terms</li>
              <li>• Dispute resolution procedures</li>
              <li>• Limitation of liability</li>
              <li>• Intellectual property rights</li>
              <li>• Service availability and modifications</li>
            </ul>
          </div>

          <div className="mb-8 rounded-3xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-8 shadow-2xl">
            <h3 className="mb-4 text-2xl font-bold">
              <span className="gradient-text">Key Principles</span>
            </h3>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <h4 className="mb-2 text-lg font-bold text-white">
                  User Protection
                </h4>
                <p className="text-[#A3B8D9]">
                  Terms designed to protect user interests and trading
                  activities.
                </p>
              </div>
              <div>
                <h4 className="mb-2 text-lg font-bold text-white">
                  Regulatory Compliance
                </h4>
                <p className="text-[#A3B8D9]">
                  Full compliance with applicable financial and trading
                  regulations.
                </p>
              </div>
              <div>
                <h4 className="mb-2 text-lg font-bold text-white">
                  Transparency
                </h4>
                <p className="text-[#A3B8D9]">
                  Clear language and transparent policies without hidden
                  clauses.
                </p>
              </div>
              <div>
                <h4 className="mb-2 text-lg font-bold text-white">
                  Fair Treatment
                </h4>
                <p className="text-[#A3B8D9]">
                  Equal treatment for all users with non-discriminatory
                  policies.
                </p>
              </div>
            </div>
          </div>

          <div className="mb-8 rounded-3xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-8 shadow-2xl">
            <h3 className="mb-4 text-2xl font-bold">
              <span className="gradient-text">
                Important Trading Considerations
              </span>
            </h3>
            <div className="rounded-2xl border border-yellow-600/30 bg-yellow-900/20 p-6">
              <h4 className="mb-3 flex items-center gap-2 text-lg font-bold text-yellow-400">
                <AlertTriangle className="h-5 w-5" />
                Risk Warning
              </h4>
              <p className="text-[#A3B8D9]">
                Trading digital assets involves substantial risk and may not be
                suitable for all investors. You should carefully consider
                whether trading is appropriate for you in light of your
                experience, objectives, financial resources, and other relevant
                circumstances.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-8 shadow-2xl">
            <h3 className="mb-4 text-2xl font-bold">
              <span className="gradient-text">Questions About Our Terms?</span>
            </h3>
            <p className="mb-4 text-[#A3B8D9]">
              If you have any questions about our terms of service or need
              clarification on any policies, please contact our legal team at:
            </p>
            <p className="font-semibold text-white">legal@dotmx.com</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
