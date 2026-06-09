import { useState } from "react";
import { usePositionOperations } from "@/hooks";
import { Position } from "@/config/types";
import { Button } from "@/components/ui";

interface QuickCloseButtonProps {
  position: Position;
  className?: string;
  onSuccess?: () => void;
}

export function QuickCloseButton({
  position,
  className,
  onSuccess,
}: QuickCloseButtonProps) {
  const [isClosing, setIsClosing] = useState(false);
  const { closePosition, isPending } = usePositionOperations();

  const handleQuickClose = async () => {
    const confirmed = window.confirm(
      `Close this ${position.isLong ? "LONG" : "SHORT"} position for ${position.market} with a market order?`
    );

    if (confirmed) {
      setIsClosing(true);
      try {
        await closePosition(position);
        onSuccess?.();
      } catch (error) {
        console.error("Failed to close position:", error);
      } finally {
        setIsClosing(false);
      }
    }
  };

  return (
    <Button
      onClick={handleQuickClose}
      disabled={isPending || isClosing}
      loading={isPending || isClosing}
      variant="trading-close"
      size="xs"
      className={className || ""}
    >
      {isPending || isClosing ? "Closing..." : "Close"}
    </Button>
  );
}
