import type { Metadata } from "next";
import { Sora } from "next/font/google";
import Script from "next/script";
import { Toaster } from "sonner";
import "./globals.css";
import { AnalyticsPageTracker } from "@/components/providers/AnalyticsProvider";
import { AuthProvider } from "@/hooks/useAuth";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "dotmx - Advanced Perpetual Trading On-Chain",
  description:
    "Experience fully on-chain perpetual trading with up to 50x cross margin leverage, deep liquidity, and transparent execution. Trade BTC, ETH, BNB, SOL, and XRP perpetuals directly from your wallet on Arbitrum with complete fund control.",
  metadataBase: new URL("https://dotmx.xyz"),
  keywords: [
    "perpetual trading",
    "onchain trading",
    "50x leverage",
    "cross margin",
    "arbitrum trading",
    "bitcoin perpetuals",
    "ethereum perpetuals",
    "BNB perpetuals",
    "solana perpetuals",
    "XRP perpetuals",
    "cryptocurrency",
    "DeFi",
    "blockchain trading",
    "perpetual swaps",
    "derivatives",
    "decentralized finance",
    "smart contracts",
    "trading platform",
    "non-custodial trading",
    "on-chain derivatives",
    "arbitrum",
    "USDC trading",
  ],
  authors: [{ name: "dotmx", url: "https://dotmx.xyz" }],
  creator: "dotmx",
  publisher: "dotmx",
  applicationName: "dotmx",
  openGraph: {
    title: "dotmx - Advanced Perpetual Trading On-Chain",
    description:
      "Experience fully on-chain perpetual trading with up to 50x cross margin leverage on Arbitrum. Trade BTC-PERP, ETH-PERP, BNB-PERP, SOL-PERP, and XRP-PERP with deep liquidity and transparent execution. No deposits required - trade directly from your wallet.",
    url: "https://dotmx.xyz",
    siteName: "dotmx.xyz",
    images: [
      {
        url: "/ogimage.png",
        width: 1200,
        height: 630,
        alt: "dotmx - Advanced Perpetual Trading Platform on Arbitrum",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "dotmx - Advanced Perpetual Trading On-Chain",
    description:
      "Trade perpetuals with up to 50x cross margin leverage on Arbitrum. BTC, ETH, BNB, SOL & XRP perpetuals with deep liquidity, fully on-chain with no deposits required. Experience CEX-like trading with complete fund control.",
    images: ["/ogimage.png"],
    creator: "@dotmx",
    site: "@dotmx",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  category: "Finance",
  classification: "Trading Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <Script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-1XC7QLBB4E"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">{`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-1XC7QLBB4E');
          `}</Script>
      </head>
      <body className={`${sora.variable} antialiased`} suppressHydrationWarning>
        <AuthProvider>
          <AnalyticsPageTracker />
          {children}
          <Toaster
            richColors
            position="top-right"
            expand={false}
            closeButton
            theme="dark"
          />
        </AuthProvider>
      </body>
    </html>
  );
}
