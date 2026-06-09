import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enhanced output configuration
  output: "standalone",

  // Performance optimizations
  experimental: {
    optimizePackageImports: ["lucide-react", "@radix-ui/react-icons"],
    optimizeServerReact: true,
  },

  // Turbopack configuration for Next.js 15
  turbopack: {},

  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },

  // Image optimization
  // Note: unoptimized is set to true for Netlify static deployment
  // If you need optimization, consider using Netlify's Image CDN or Next.js runtime
  images: {
    unoptimized: true, // Required for static export and Netlify deployment
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.coingecko.com",
        port: "",
        pathname: "/coins/images/**",
      },
      {
        protocol: "https",
        hostname: "coin-images.coingecko.com",
        port: "",
        pathname: "/coins/images/**",
      },
    ],
    formats: ["image/webp", "image/avif"],
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https: wss:; font-src 'self'",
          },
        ],
      },
      {
        // Apply cache headers to charting library files
        source: "/charting_library/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Cache static assets
        source: "/public/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=60",
          },
        ],
      },
    ];
  },

  // URL rewrites for TradingView and API routes
  async rewrites() {
    return [
      // Rewrite TradingView library bundles to the correct path
      {
        source: "/trade/bundles/:path*",
        destination: "/charting_library/bundles/:path*",
      },
      // API proxy for external services (if needed)
      {
        source: "/api/proxy/:path*",
        destination: "https://api.example.com/:path*",
      },
    ];
  },

  // Redirects for better SEO
  async redirects() {
    return [
      {
        source: "/trading",
        destination: "/trade",
        permanent: true,
      },
      {
        source: "/perps",
        destination: "/trade",
        permanent: true,
      },
    ];
  },

  // TypeScript configuration
  typescript: {
    ignoreBuildErrors: false,
  },

  // ESLint configuration
  eslint: {
    ignoreDuringBuilds: false,
    dirs: ["src"],
  },

  // Environment variables validation
  // Note: do not expose non-public env vars here — use NEXT_PUBLIC_ prefix only
  // for values that are safe to expose to the client bundle.
  env: {
    // NEXT_PUBLIC_CUSTOM_KEY: process.env.NEXT_PUBLIC_CUSTOM_KEY,
  },
};

export default nextConfig;
