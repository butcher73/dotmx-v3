import { Layout } from "@/components/common";
import {
  Lock,
  Shield,
  Snowflake,
  Award,
  FileText,
  Bug,
  AlertTriangle,
} from "lucide-react";

export default function SecurityPage() {
  return (
    <Layout>
      <div className="container mx-auto px-6 py-20">
        <div className="mb-16 text-center">
          <h1 className="mb-8 text-5xl font-bold lg:text-6xl">
            <span className="gradient-text">Security</span>
          </h1>
          <p className="mx-auto max-w-3xl text-xl leading-relaxed text-gray-300">
            Your security is our top priority. Learn about our comprehensive
            security measures and best practices.
          </p>
        </div>

        <div className="mx-auto max-w-6xl">
          <div className="mb-16 grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="rounded-3xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-8 shadow-2xl">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-[#4F90FF] to-[#2563EB]">
                <Lock className="h-8 w-8 text-white" />
              </div>
              <h3 className="mb-4 text-2xl font-bold">
                <span className="gradient-text">Encryption</span>
              </h3>
              <p className="text-lg text-[#A3B8D9]">
                Military-grade encryption protects all user data and
                transactions both in transit and at rest.
              </p>
            </div>
            <div className="rounded-3xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-8 shadow-2xl">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-[#4F90FF] to-[#2563EB]">
                <Shield className="h-8 w-8 text-white" />
              </div>
              <h3 className="mb-4 text-2xl font-bold">
                <span className="gradient-text">
                  Multi-Factor Authentication
                </span>
              </h3>
              <p className="text-lg text-[#A3B8D9]">
                Multiple layers of authentication including 2FA, hardware keys,
                and biometric verification.
              </p>
            </div>
            <div className="rounded-3xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-8 shadow-2xl">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-[#4F90FF] to-[#2563EB]">
                <Snowflake className="h-8 w-8 text-white" />
              </div>
              <h3 className="mb-4 text-2xl font-bold">
                <span className="gradient-text">Cold Storage</span>
              </h3>
              <p className="text-lg text-[#A3B8D9]">
                The majority of user funds are stored in offline cold storage
                wallets with multi-signature security.
              </p>
            </div>
          </div>

          <div className="mb-12 rounded-3xl border border-[#23345C] bg-linear-to-r from-[#122347] to-[#1A2E57] p-12 shadow-2xl">
            <h2 className="mb-8 text-center text-4xl font-bold">
              <span className="gradient-text">Platform Security Features</span>
            </h2>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              <div>
                <h4 className="mb-4 text-xl font-bold text-white">
                  Infrastructure Security
                </h4>
                <ul className="space-y-2 text-[#A3B8D9]">
                  <li>• Advanced DDoS protection</li>
                  <li>• Regular security audits and penetration testing</li>
                  <li>• Real-time monitoring and threat detection</li>
                  <li>• Secure API endpoints with rate limiting</li>
                  <li>• SOC 2 Type II compliance (Coming Soon)</li>
                </ul>
              </div>
              <div>
                <h4 className="mb-4 text-xl font-bold text-white">
                  Smart Contract Security
                </h4>
                <ul className="space-y-2 text-[#A3B8D9]">
                  <li>• Third-party smart contract audits</li>
                  <li>• Formal verification of critical contracts</li>
                  <li>• Bug bounty programs</li>
                  <li>• Time-locked upgrades</li>
                  <li>• Emergency pause mechanisms</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mb-12 grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="rounded-3xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-8 shadow-2xl">
              <h3 className="mb-6 text-2xl font-bold">
                <span className="gradient-text">
                  Account Security Best Practices
                </span>
              </h3>
              <ul className="space-y-3 text-[#A3B8D9]">
                <li className="flex items-start">
                  <span className="mt-1 mr-3 text-[#4F90FF]">•</span>
                  <span>Enable 2FA on your account</span>
                </li>
                <li className="flex items-start">
                  <span className="mt-1 mr-3 text-[#4F90FF]">•</span>
                  <span>Use a strong, unique password</span>
                </li>
                <li className="flex items-start">
                  <span className="mt-1 mr-3 text-[#4F90FF]">•</span>
                  <span>Never share your private keys</span>
                </li>
                <li className="flex items-start">
                  <span className="mt-1 mr-3 text-[#4F90FF]">•</span>
                  <span>Verify URLs before entering credentials</span>
                </li>
                <li className="flex items-start">
                  <span className="mt-1 mr-3 text-[#4F90FF]">•</span>
                  <span>Keep your devices and browsers updated</span>
                </li>
                <li className="flex items-start">
                  <span className="mt-1 mr-3 text-[#4F90FF]">•</span>
                  <span>Log out when using public computers</span>
                </li>
              </ul>
            </div>

            <div className="rounded-3xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-8 shadow-2xl">
              <h3 className="mb-6 text-2xl font-bold">
                <span className="gradient-text">Incident Response</span>
              </h3>
              <p className="mb-4 text-[#A3B8D9]">
                In the unlikely event of a security incident, we have
                comprehensive response procedures:
              </p>
              <ul className="space-y-3 text-[#A3B8D9]">
                <li className="flex items-start">
                  <span className="mt-1 mr-3 text-[#4F90FF]">•</span>
                  <span>Immediate threat containment</span>
                </li>
                <li className="flex items-start">
                  <span className="mt-1 mr-3 text-[#4F90FF]">•</span>
                  <span>User notification within 24 hours</span>
                </li>
                <li className="flex items-start">
                  <span className="mt-1 mr-3 text-[#4F90FF]">•</span>
                  <span>Forensic investigation</span>
                </li>
                <li className="flex items-start">
                  <span className="mt-1 mr-3 text-[#4F90FF]">•</span>
                  <span>Coordination with law enforcement</span>
                </li>
                <li className="flex items-start">
                  <span className="mt-1 mr-3 text-[#4F90FF]">•</span>
                  <span>Transparent incident reporting</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mb-12 rounded-3xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-8 shadow-2xl">
            <h3 className="mb-6 text-2xl font-bold">
              <span className="gradient-text">
                Security Audits & Certifications
              </span>
            </h3>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-linear-to-br from-[#4F90FF] to-[#2563EB]">
                  <Award className="h-10 w-10 text-white" />
                </div>
                <h4 className="mb-2 text-lg font-bold text-white">
                  Smart Contract Audits
                </h4>
                <p className="text-sm text-[#A3B8D9]">
                  Audited by leading security firms
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-linear-to-br from-[#4F90FF] to-[#2563EB]">
                  <FileText className="h-10 w-10 text-white" />
                </div>
                <h4 className="mb-2 text-lg font-bold text-white">
                  Compliance
                </h4>
                <p className="text-sm text-[#A3B8D9]">
                  SOC 2 Type II certification in progress
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-linear-to-br from-[#4F90FF] to-[#2563EB]">
                  <Bug className="h-10 w-10 text-white" />
                </div>
                <h4 className="mb-2 text-lg font-bold text-white">
                  Bug Bounty
                </h4>
                <p className="text-sm text-[#A3B8D9]">
                  Continuous security testing program
                </p>
              </div>
            </div>
          </div>

          <div className="mb-12 rounded-3xl border border-red-600/30 bg-red-900/20 p-8">
            <h3 className="mb-4 flex items-center gap-2 text-2xl font-bold text-red-400">
              <AlertTriangle className="h-6 w-6" />
              Security Alert: Beware of Scams
            </h3>
            <p className="mb-4 text-[#A3B8D9]">
              dotmx will NEVER ask for your private keys, passwords, or 2FA
              codes. Be aware of common scams:
            </p>
            <ul className="space-y-2 text-[#A3B8D9]">
              <li>• Phishing emails or fake websites</li>
              <li>• Social media impersonators</li>
              <li>• Fake customer support contacts</li>
              <li>• Unsolicited investment opportunities</li>
            </ul>
          </div>

          <div className="text-center">
            <h3 className="mb-4 text-2xl font-bold">
              <span className="gradient-text">
                Security Questions or Concerns?
              </span>
            </h3>
            <p className="mb-6 text-lg text-[#A3B8D9]">
              If you have security concerns or suspect unauthorized account
              activity, contact us immediately.
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <a
                href="mailto:security@dotmx.com"
                className="rounded-2xl bg-linear-to-r from-[#4F90FF] to-[#2563EB] px-6 py-3 font-bold text-white transition-all duration-300 hover:shadow-lg hover:shadow-[#4F90FF]/20"
              >
                security@dotmx.com
              </a>
              <button className="rounded-2xl border border-[#3A4F6A] bg-[#23345C] px-6 py-3 font-bold text-white transition-all duration-300 hover:bg-[#2A3F67]">
                Emergency: Disable Account
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
