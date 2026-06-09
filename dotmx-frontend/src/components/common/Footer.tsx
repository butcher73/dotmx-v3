import Link from "next/link";
import { Twitter, MessageCircle, Mail } from "lucide-react";
import { SOCIAL_LINKS } from "@/config/constants";

export default function Footer() {
  return (
    <footer className="bg-black py-20">
      <div className="container mx-auto px-6">
        <div className="mb-12 text-center">
          <div className="mb-8 flex items-center justify-center space-x-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-br from-[#3A8DFF] to-[#00D1FF]">
              <span className="text-lg font-bold text-white">mx</span>
            </div>
            <span className="text-2xl font-bold text-white">dotmx</span>
          </div>
          <p className="mx-auto mb-12 max-w-4xl text-lg leading-relaxed text-[#A3B8D9]">
            DotMX is an Ethereum Layer 2 execution layer for perpetual trading.
            Trading perpetual contracts involves significant risk and may not be
            suitable for all users. DotMX does not provide investment advice.
            Users trade at their own risk.
          </p>
        </div>

        <div className="mb-16 grid grid-cols-1 gap-12 md:grid-cols-5">
          <div>
            <h4 className="mb-6 text-lg font-bold text-[#3A8DFF]">Trading</h4>
            <ul className="space-y-3 text-[#A3B8D9]">
              <li>
                <Link
                  href="/trade"
                  className="text-lg transition-colors hover:text-[#3A8DFF]"
                >
                  Perp Trading
                </Link>
              </li>
              <li>
                <span className="group relative cursor-not-allowed text-lg text-[#A3B8D9] opacity-50">
                  Futures
                  <span className="absolute top-1/2 left-full ml-2 -translate-y-1/2 transform rounded bg-black px-2 py-1 text-xs whitespace-nowrap text-[#3A8DFF] opacity-0 transition-opacity group-hover:opacity-100">
                    Coming Soon
                  </span>
                </span>
              </li>
              <li>
                <span className="group relative cursor-not-allowed text-lg text-[#A3B8D9] opacity-50">
                  Options
                  <span className="absolute top-1/2 left-full ml-2 -translate-y-1/2 transform rounded bg-black px-2 py-1 text-xs whitespace-nowrap text-[#3A8DFF] opacity-0 transition-opacity group-hover:opacity-100">
                    Coming Soon
                  </span>
                </span>
              </li>
              <li>
                <Link
                  href="/portal/lp"
                  className="text-lg transition-colors hover:text-[#3A8DFF]"
                >
                  Liquidity
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="mb-6 text-lg font-bold text-[#3A8DFF]">Products</h4>
            <ul className="space-y-3 text-[#A3B8D9]">
              <li>
                <Link
                  href="/trade"
                  className="text-lg transition-colors hover:text-[#3A8DFF]"
                >
                  Trading Interface
                </Link>
              </li>
              <li>
                <Link
                  href="/analytics"
                  className="text-lg transition-colors hover:text-[#3A8DFF]"
                >
                  Analytics
                </Link>
              </li>
              <li>
                <Link
                  href="/portal/portfolio"
                  className="text-lg transition-colors hover:text-[#3A8DFF]"
                >
                  Portfolio
                </Link>
              </li>
              <li>
                <Link
                  href="/docs"
                  className="text-lg transition-colors hover:text-[#3A8DFF]"
                >
                  Documentation
                </Link>
              </li>
              <li>
                <Link
                  href="/api"
                  className="text-lg transition-colors hover:text-[#3A8DFF]"
                >
                  API
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="mb-6 text-lg font-bold text-[#3A8DFF]">Company</h4>
            <ul className="space-y-3 text-[#A3B8D9]">
              <li>
                <Link
                  href="/about"
                  className="text-lg transition-colors hover:text-[#3A8DFF]"
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  href="/blog"
                  className="text-lg transition-colors hover:text-[#3A8DFF]"
                >
                  Blog
                </Link>
              </li>
              <li>
                <Link
                  href="/careers"
                  className="text-lg transition-colors hover:text-[#3A8DFF]"
                >
                  Careers
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-lg transition-colors hover:text-[#3A8DFF]"
                >
                  Contact
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="mb-6 text-lg font-bold text-[#3A8DFF]">Legal</h4>
            <ul className="space-y-3 text-[#A3B8D9]">
              <li>
                <Link
                  href="/privacy"
                  className="text-lg transition-colors hover:text-[#3A8DFF]"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-lg transition-colors hover:text-[#3A8DFF]"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  href="/risk-disclosure"
                  className="text-lg transition-colors hover:text-[#3A8DFF]"
                >
                  Risk Disclosure
                </Link>
              </li>
              <li>
                <Link
                  href="/security"
                  className="text-lg transition-colors hover:text-[#3A8DFF]"
                >
                  Security
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="mb-6 text-lg font-bold text-[#3A8DFF]">Social</h4>
            <div className="flex space-x-4">
              <a
                href={SOCIAL_LINKS.TWITTER}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#23345C] text-[#A3B8D9] transition-all duration-200 hover:bg-[#3A8DFF] hover:text-white"
                aria-label="Follow us on Twitter"
              >
                <Twitter size={18} />
              </a>
              <a
                href={SOCIAL_LINKS.TELEGRAM}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#23345C] text-[#A3B8D9] transition-all duration-200 hover:bg-[#3A8DFF] hover:text-white"
                aria-label="Join our Telegram"
              >
                <MessageCircle size={18} />
              </a>
              <a
                href={`mailto:${SOCIAL_LINKS.EMAIL}`}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#23345C] text-[#A3B8D9] transition-all duration-200 hover:bg-[#3A8DFF] hover:text-white"
                aria-label="Email us"
              >
                <Mail size={18} />
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-[#23345C] pt-8 text-center">
          <p className="text-lg text-[#A3B8D9]">
            &copy; 2025 dotmx. All rights reserved. Built for the future of
            decentralized trading.
          </p>
        </div>
      </div>
    </footer>
  );
}
