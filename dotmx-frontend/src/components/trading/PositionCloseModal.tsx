import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { usePositionOperations } from "@/hooks";
import { Position } from "@/config/types";
import { formatCurrency } from "@/utils/marketData";
import { Button } from "@/components/ui";

interface PositionCloseModalProps {
  position: Position | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  currentPrice?: number;
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

export function PositionCloseModal({
  position,
  isOpen,
  onClose,
  onSuccess,
  currentPrice,
}: PositionCloseModalProps) {
  const [closePercentage, setClosePercentage] = useState(100);

  const { closePosition, partialClosePosition, isPending, isSuccess, error } =
    usePositionOperations();

  // Handle successful transaction
  useEffect(() => {
    if (isSuccess) {
      onSuccess?.();
      onClose();
    }
  }, [isSuccess, onSuccess, onClose]);

  const handleClose = async () => {
    if (!position) return;

    try {
      if (closePercentage === 100) {
        await closePosition(position);
      } else {
        await partialClosePosition(position, closePercentage);
      }
    } catch (err) {
      console.error("Failed to close position:", err);
    }
  };

  if (!isOpen || !position) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="border-border bg-background-card relative w-full max-w-md rounded-lg border p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-foreground text-lg font-semibold">
              Close Position
            </h3>
            <p className="text-foreground-muted text-sm">{position.market}</p>
          </div>
          <Button
            className="text-foreground-muted hover:text-foreground"
            onClick={onClose}
            variant="icon-only"
            size="sm"
            icon={<X className="h-5 w-5" />}
          />
        </div>

        <div className="bg-background-elevated mb-6 rounded-lg p-4">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-foreground-muted">Position Amount</span>
              <span className="text-foreground font-medium">
                {formatNumber(Number(position.size) / 10 ** 6)}{" "}
                {position.market.split("-")[0]}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-muted">Entry Price</span>
              <span className="text-foreground font-medium">
                ${formatNumber(Number(position.price) / 10 ** 6)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-muted">Position Value</span>
              <span className="text-foreground font-medium">
                $
                {formatNumber(
                  (Number(position.size) * Number(position.price)) / 10 ** 12
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-muted">Current Price</span>
              <span className="text-foreground font-medium">
                ${currentPrice ? formatNumber(currentPrice) : "Loading..."}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-muted">Unrealized PnL</span>
              <span
                className={`font-semibold ${Number(position.upl) >= 0 ? "text-positive" : "text-negative"}`}
              >
                {Number(position.upl) >= 0 ? "+" : ""}
                {formatCurrency(Number(position.upl) / 10 ** 6)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-muted">Direction</span>
              <span
                className={`font-medium ${position.isLong ? "text-positive" : "text-negative"}`}
              >
                {position.isLong ? "LONG" : "SHORT"}
              </span>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h4 className="text-foreground mb-3 text-sm font-medium">
            Close Options
          </h4>
          <div className="grid grid-cols-4 gap-2">
            {[25, 50, 75, 100].map((percent) => (
              <Button
                key={percent}
                onClick={() => setClosePercentage(percent)}
                variant="percentage"
                active={closePercentage === percent}
                size="sm"
                className="flex-col"
              >
                <div className="text-lg font-bold">{percent}%</div>
                <div className="text-xs">
                  $
                  {formatNumber(
                    (Number(position.size) * Number(position.price) * percent) /
                      (100 * 10 ** 12)
                  )}
                </div>
              </Button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-900/20 p-3">
            <div className="text-sm text-red-400">Error: {error.message}</div>
          </div>
        )}

        <div className="flex space-x-3">
          <Button
            fullWidth
            variant="secondary"
            onClick={onClose}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            fullWidth
            variant="danger"
            onClick={handleClose}
            disabled={isPending}
            loading={isPending}
          >
            {isPending ? "Closing..." : `Close ${closePercentage}% Position`}
          </Button>
        </div>
      </div>
    </div>
  );
}
