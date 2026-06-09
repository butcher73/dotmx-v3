import { Layout } from "@/components/common";
import {
  MessageCircle,
  Handshake,
  Newspaper,
  Smartphone,
  Twitter,
  Mail,
} from "lucide-react";

export default function ContactPage() {
  return (
    <Layout>
      <div className="container mx-auto px-6 py-20">
        <div className="mb-16 text-center">
          <h1 className="mb-8 text-5xl font-bold lg:text-6xl">
            <span className="gradient-text">Contact</span>
          </h1>
          <p className="mx-auto max-w-3xl text-xl leading-relaxed text-[#A3B8D9]">
            Get in touch with our team for support, partnerships, or general
            inquiries.
          </p>
        </div>

        <div className="mx-auto max-w-6xl">
          <div className="mb-16 grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="group rounded-3xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-8 text-center shadow-2xl transition-all duration-300 hover:border-[#3A8DFF]">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-[#3A8DFF] to-[#00D1FF] shadow-lg transition-all duration-500 group-hover:shadow-[#3A8DFF]/30">
                <MessageCircle className="h-8 w-8 text-white" />
              </div>
              <h3 className="mb-4 text-2xl font-bold">
                <span className="gradient-text">General Support</span>
              </h3>
              <p className="mb-6 text-lg text-[#A3B8D9]">
                Questions about trading, platform features, or account issues.
              </p>
              <p className="font-semibold text-white">support@dotmx.com</p>
            </div>
            <div className="group rounded-3xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-8 text-center shadow-2xl transition-all duration-300 hover:border-[#3A8DFF]">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-[#3A8DFF] to-[#00D1FF] shadow-lg transition-all duration-500 group-hover:shadow-[#3A8DFF]/30">
                <Handshake className="h-8 w-8 text-white" />
              </div>
              <h3 className="mb-4 text-2xl font-bold">
                <span className="gradient-text">Partnerships</span>
              </h3>
              <p className="mb-6 text-lg text-[#A3B8D9]">
                Business development and strategic partnership opportunities.
              </p>
              <p className="font-semibold text-white">partnerships@dotmx.com</p>
            </div>
            <div className="group rounded-3xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-8 text-center shadow-2xl transition-all duration-300 hover:border-[#3A8DFF]">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-[#3A8DFF] to-[#00D1FF] shadow-lg transition-all duration-500 group-hover:shadow-[#3A8DFF]/30">
                <Newspaper className="h-8 w-8 text-white" />
              </div>
              <h3 className="mb-4 text-2xl font-bold">
                <span className="gradient-text">Media & Press</span>
              </h3>
              <p className="mb-6 text-lg text-[#A3B8D9]">
                Press inquiries, interviews, and media resources.
              </p>
              <p className="font-semibold text-white">press@dotmx.com</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
            <div className="rounded-3xl border border-[#23345C] bg-linear-to-r from-[#122347] to-[#1A2E57] p-8 shadow-2xl">
              <h2 className="mb-8 text-3xl font-bold">
                <span className="gradient-text-silver">Send us a Message</span>
              </h2>
              <form className="space-y-6">
                <div>
                  <label className="mb-2 block font-semibold text-white">
                    Name
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-[#23345C] bg-[#0A1733] px-4 py-3 text-white transition-all duration-200 focus:border-[#3A8DFF] focus:ring-2 focus:ring-[#3A8DFF]/20 focus:outline-none"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="mb-2 block font-semibold text-white">
                    Email
                  </label>
                  <input
                    type="email"
                    className="w-full rounded-xl border border-[#23345C] bg-[#0A1733] px-4 py-3 text-white transition-all duration-200 focus:border-[#3A8DFF] focus:ring-2 focus:ring-[#3A8DFF]/20 focus:outline-none"
                    placeholder="your@email.com"
                  />
                </div>
                <div>
                  <label className="mb-2 block font-semibold text-white">
                    Subject
                  </label>
                  <select className="w-full rounded-xl border border-[#23345C] bg-[#0A1733] px-4 py-3 text-white transition-all duration-200 focus:border-[#3A8DFF] focus:ring-2 focus:ring-[#3A8DFF]/20 focus:outline-none">
                    <option>General Inquiry</option>
                    <option>Technical Support</option>
                    <option>Partnership</option>
                    <option>Media/Press</option>
                    <option>Bug Report</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block font-semibold text-white">
                    Message
                  </label>
                  <textarea
                    rows={5}
                    className="w-full resize-none rounded-xl border border-[#23345C] bg-[#0A1733] px-4 py-3 text-white transition-all duration-200 focus:border-[#3A8DFF] focus:ring-2 focus:ring-[#3A8DFF]/20 focus:outline-none"
                    placeholder="Tell us how we can help..."
                  />
                </div>
                <button
                  type="submit"
                  className="w-full transform rounded-2xl bg-linear-to-r from-[#3A8DFF] to-[#00D1FF] px-8 py-4 font-bold text-white transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-[#3A8DFF]/30"
                >
                  Send Message
                </button>
              </form>
            </div>

            <div className="space-y-8">
              <div className="rounded-3xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-8 shadow-2xl">
                <h3 className="mb-6 text-2xl font-bold">
                  <span className="gradient-text">Office Hours</span>
                </h3>
                <div className="space-y-3 text-[#A3B8D9]">
                  <div className="flex justify-between">
                    <span>Monday - Friday</span>
                    <span className="text-white">9:00 AM - 6:00 PM UTC</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Saturday</span>
                    <span className="text-white">10:00 AM - 4:00 PM UTC</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sunday</span>
                    <span className="text-[#A3B8D9]/60">Closed</span>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-8 shadow-2xl">
                <h3 className="mb-6 text-2xl font-bold">
                  <span className="gradient-text">Community</span>
                </h3>
                <div className="space-y-4">
                  <a
                    href="#"
                    className="flex items-center text-[#A3B8D9] transition-colors hover:text-[#3A8DFF]"
                  >
                    <Smartphone className="mr-3 h-5 w-5" />
                    <span>Discord Community</span>
                  </a>
                  <a
                    href="#"
                    className="flex items-center text-[#A3B8D9] transition-colors hover:text-[#3A8DFF]"
                  >
                    <Twitter className="mr-3 h-5 w-5" />
                    <span>Twitter Updates</span>
                  </a>
                  <a
                    href="#"
                    className="flex items-center text-[#A3B8D9] transition-colors hover:text-[#3A8DFF]"
                  >
                    <Mail className="mr-3 h-5 w-5" />
                    <span>Newsletter</span>
                  </a>
                </div>
              </div>

              <div className="rounded-3xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-8 shadow-2xl">
                <h3 className="mb-6 text-2xl font-bold">
                  <span className="gradient-text">Response Time</span>
                </h3>
                <p className="mb-4 text-[#A3B8D9]">
                  We aim to respond to all inquiries within 24 hours during
                  business days.
                </p>
                <p className="text-sm text-[#A3B8D9]/80">
                  For urgent technical issues, please use our Discord community
                  for faster support.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
