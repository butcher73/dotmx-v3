"use client";

import React, { useState } from "react";
import { useTradingOperations } from "@/hooks";
import { Position } from "@/config/types";
import { QuickCloseButton } from "./QuickCloseButton";
import { PositionCloseModal } from "./PositionCloseModal";
import { SideBadge } from "./shared/TradingBadge";
import {
  formatPrice2DecimalsWithCommas,
  formatUSD,
  formatPnL,
  getPnLColor,
  formatLeverage,
  formatPercentage,
} from "@/utils/formatting";
import { Layers } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "./shared";

interface PositionsTableProps {
  className?: string;
}

function formatBigIntToNumber(val: bigint, decimals = 6): number {
  return Number(val) / 10 ** decimals;
}

export default function PositionsTable({
  className = "",
}: PositionsTableProps) {
  const { positions, isLoading, error, manualRefresh } = useTradingOperations();
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleCloseSuccess = () => manualRefresh();

  if (error) return <ErrorState message={error.message} />;
  if (isLoading) return <LoadingState label="Loading positions…" />;
  if (positions.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title="No open positions"
        subtitle="Place a trade to open a position"
      />
    );
  }

  return (
    <>
      <div className={`overflow-x-auto ${className}`}>
        <table className="w-full">
          <thead className="border-border sticky top-0 z-10 border-b">
            <tr>
              {[
                "Symbol",
                "Side",
                "Size",
                "Entry",
                "Mark",
                "Liq.",
                "Margin",
                "Lev.",
                "PnL",
                "Actions",
              ].map((h, i) => (
                <th
                  key={h}
                  className={`text-foreground-muted px-3 py-2 text-left text-[11px] font-medium tracking-wider uppercase ${
                    i === 9 ? "text-right" : ""
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {positions.map((position, idx) => {
              const size = formatBigIntToNumber(position.size);
              const entryPrice = formatBigIntToNumber(position.price);
              const margin = formatBigIntToNumber(position.margin);
              const upl = formatBigIntToNumber(position.upl);
              const pnlPercent = margin > 0 ? (upl / margin) * 100 : 0;

              return (
                <tr
                  key={`${position.market}-${position.timestamp}-${idx}`}
                  className="hover:bg-background-hover transition-colors"
                >
                  <td className="text-foreground px-3 py-2.5 text-xs font-semibold">
                    {position.market}
                  </td>
                  <td className="px-3 py-2.5">
                    <SideBadge side={position.isLong ? "long" : "short"} />
                  </td>
                  <td className="text-foreground px-3 py-2.5 font-mono text-xs">
                    {size.toFixed(4)}
                  </td>
                  <td className="text-foreground px-3 py-2.5 font-mono text-xs">
                    ${formatPrice2DecimalsWithCommas(entryPrice)}
                  </td>
                  <td className="text-foreground-muted px-3 py-2.5 font-mono text-xs">
                    —
                  </td>
                  <td className="text-foreground-muted px-3 py-2.5 font-mono text-xs">
                    —
                  </td>
                  <td className="text-foreground px-3 py-2.5 font-mono text-xs">
                    {formatUSD(margin)}
                  </td>
                  <td className="text-foreground px-3 py-2.5 font-mono text-xs">
                    {formatLeverage(position.leverage)}
                  </td>
                  <td
                    className={`px-3 py-2.5 font-mono text-xs ${getPnLColor(upl)}`}
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold">{formatPnL(upl)}</span>
                      <span className="text-[10px] opacity-60">
                        {formatPercentage(pnlPercent)}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <QuickCloseButton
                        position={position}
                        onSuccess={handleCloseSuccess}
                      />
                      <button
                        onClick={() => {
                          setSelectedPosition(position);
                          setIsModalOpen(true);
                        }}
                        className="text-foreground-muted hover:text-foreground text-[11px] transition-colors"
                      >
                        Partial
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <PositionCloseModal
        position={selectedPosition}
        isOpen={isModalOpen}
        onClose={() => {
          setSelectedPosition(null);
          setIsModalOpen(false);
        }}
        onSuccess={handleCloseSuccess}
      />
    </>
  );
}
