"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUIAnalytics } from "@/hooks/useAnalytics";

export default function TradePage() {
  const router = useRouter();
  const { trackPageView } = useUIAnalytics();

  useEffect(() => {
    // Track page view for trade redirect page
    trackPageView("/trade");

    // Redirect to the perp trading page with BTC symbol
    router.replace("/trade/perp?symbol=BTC");
  }, [router, trackPageView]);

  // Show a loading state while redirecting
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B1426]">
      <div className="text-center">
        <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-white"></div>
        <p className="text-white">Redirecting to trading page...</p>
      </div>
    </div>
  );
}
