import { ReactNode } from "react";
import Script from "next/script";

export default function TradeLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* TradingView Charting Library - Only loaded on trading pages */}
      <Script
        src="/charting_library/charting_library.standalone.js"
        strategy="beforeInteractive"
      />
      <div className="min-h-screen">{children}</div>
    </>
  );
}
