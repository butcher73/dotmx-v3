"use client";

import React, { useState, useCallback } from "react";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Order } from "../../config/types";
import { useCancelOrder } from "@/hooks/useTrading";

interface OrderActionsProps {
  order: Order;
  onCancelled?: () => void;
}

export default function OrderActions({ order, onCancelled }: OrderActionsProps) {
  const [confirming, setConfirming] = useState(false);
  const { cancelOrder, isLoading } = useCancelOrder();

  const handleCancel = useCallback(async () => {
    try {
      await cancelOrder(order.id);
      toast.success("Order cancelled");
      onCancelled?.();
    } catch {
      toast.error("Failed to cancel order");
    } finally {
      setConfirming(false);
    }
  }, [cancelOrder, order.id, onCancelled]);

  if (isLoading) {
    return (
      <button
        disabled
        className="inline-flex items-center gap-1.5 rounded-md bg-surface-secondary px-3 py-1.5 text-xs text-foreground-muted"
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        Cancelling…
      </button>
    );
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          onClick={handleCancel}
          className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors"
        >
          Confirm
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="rounded-md bg-surface-secondary px-2 py-1.5 text-xs text-foreground-muted hover:text-foreground transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="rounded-md border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors"
    >
      Cancel
    </button>
  );
}
