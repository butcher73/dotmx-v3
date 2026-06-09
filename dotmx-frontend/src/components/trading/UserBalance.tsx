"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useAccount } from "@/hooks/useAuth";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { formatUnits } from "@/utils/units";
import { useOptimizedAccountData } from "@/hooks";
import { useConsistentPNL } from "@/hooks";
import {
  formatAvailableBalance,
  formatBalance,
  formatExactUSDC,
  formatMarginLevel,
} from "@/utils/formatting";

interface UserBalanceProps {
  className?: string;
}

// Memoized balance metrics calculation - local helper function
const useLocalAccountMetrics = (
  protocolBalance: bigint | undefined,
  unrealizedPnl: number | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userPositionsData: any
) => {
  return useMemo(() => {
    const balance = protocolBalance
      ? parseFloat(formatUnits(protocolBalance, 6))
      : 0;
    const upl = unrealizedPnl ?? 0;

    // Calculate locked margin from positions
    let lockedMargin = 0;
    if (userPositionsData) {
      const [positions] = userPositionsData as [
        Array<{
          isLong: boolean;
          timestamp: bigint;
          user: string;
          market: string;
          fundingTracker: bigint;
          price: bigint;
          margin: bigint;
          size: bigint;
        }>,
        bigint[],
      ];
      if (positions && Array.isArray(positions)) {
        lockedMargin = positions.reduce((total, position) => {
          return total + parseFloat(formatUnits(position.margin, 6));
        }, 0);
      }
    }

    const equity = balance + upl;
    const freeMargin = equity - lockedMargin;
    const marginLevel = lockedMargin > 0 ? (equity / lockedMargin) * 100 : 0;

    return {
      balance,
      upl,
      equity,
      lockedMargin,
      freeMargin,
      marginLevel,
    };
  }, [protocolBalance, unrealizedPnl, userPositionsData]);
};

export default function UserBalance({ className = "" }: UserBalanceProps) {
  const [showBalanceActions, setShowBalanceActions] = useState(false);
  const [amount, setAmount] = useState("");
  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">("deposit");
  const [isMounted, setIsMounted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentOperation, setCurrentOperation] = useState<
    "approve" | "deposit" | "withdraw" | null
  >(null);
  const balanceRef = useRef<HTMLDivElement>(null);
  const lastTransactionHashRef = useRef<string | null>(null);

  // Wallet connection
  const { isConnected } = useAccount();
  // Using backend API for all data and operations
  const chainId = 1; // Default to mainnet for display purposes

  // Contract addresses not needed - using API backend
  const storeContract: `0x${string}` | null = null;
  const usdcContract: `0x${string}` | null = null;

  // Use optimized account data for consistency
  const {
    protocolBalance: optimizedProtocolBalance,
    usdcBalance: optimizedUsdcBalance,
    unrealizedPnl: optimizedUnrealizedPnl,
    positions: optimizedPositionsData,
    isLoading: isAccountDataLoading,
    refreshAll: refreshAccountData,
  } = useOptimizedAccountData();

  // Use consistent PNL for debugging and validation
  const {
    totalUPL: consistentTotalUPL,
    isConsistent: isPNLConsistent,
    discrepancy: pnlDiscrepancy,
  } = useConsistentPNL();

  // Log PNL discrepancies for debugging
  useEffect(() => {
    if (!isPNLConsistent && pnlDiscrepancy !== undefined) {
      // PNL consistency check (silent fail in production)
    }
  }, [
    isPNLConsistent,
    pnlDiscrepancy,
    optimizedUnrealizedPnl,
    consistentTotalUPL,
  ]);

  // TODO: Implement deposit/withdraw via API
  const depositUSDC = useCallback(async () => {
    // Implement API call here
  }, []);
  const withdrawUSDC = useCallback(async () => {
    // Implement API call here
  }, []);
  const approveUSDC = useCallback(async () => {
    // Implement API call here
  }, []);
  const isPending = false;
  const isSuccess = false;
  const [tradeServiceError] = useState<Error | null>(null);
  const transactionHash: string | null = null;

  // USDC allowance handled by backend API
  const usdcAllowance: bigint | undefined = undefined;
  const refetchUsdcAllowance = async () => {
    // Implement API call here
  };

  // Calculate account metrics using the optimized data
  const accountMetrics = useLocalAccountMetrics(
    optimizedProtocolBalance,
    optimizedUnrealizedPnl,
    optimizedPositionsData
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        balanceRef.current &&
        !balanceRef.current.contains(event.target as Node)
      ) {
        setShowBalanceActions(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Handle hydration - set mounted state after client-side hydration
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Get total balance (wallet + protocol) using optimized data
  const getTotalBalance = useCallback(() => {
    const walletBalance = optimizedUsdcBalance
      ? parseFloat(formatUnits(optimizedUsdcBalance as bigint, 6))
      : 0;
    const protocolBal = optimizedProtocolBalance
      ? parseFloat(formatUnits(optimizedProtocolBalance as bigint, 6))
      : 0;
    return walletBalance + protocolBal;
  }, [optimizedUsdcBalance, optimizedProtocolBalance]);

  // Validate amount for deposit/withdraw with memoization
  const isValidAmount = useMemo(() => {
    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) return false;

    if (activeTab === "deposit") {
      // For deposit, check if user has enough USDC balance
      if (optimizedUsdcBalance) {
        const userUsdcBalance = parseFloat(
          formatUnits(optimizedUsdcBalance as bigint, 6)
        );
        return numAmount <= userUsdcBalance;
      }
      return false;
    } else {
      // For withdraw, check if amount doesn't exceed free margin
      return numAmount <= accountMetrics.freeMargin;
    }
  }, [amount, activeTab, optimizedUsdcBalance, accountMetrics.freeMargin]);

  // Get validation message for better UX
  const getValidationMessage = useCallback(() => {
    const numAmount = parseFloat(amount);

    if (!amount) return null;
    if (isNaN(numAmount) || numAmount <= 0)
      return "Please enter a valid amount";

    if (activeTab === "deposit") {
      // Basic deposit validation
      if (numAmount < 1) return "Minimum deposit is $1";

      if (optimizedUsdcBalance) {
        const userUsdcBalance = parseFloat(
          formatUnits(optimizedUsdcBalance as bigint, 6)
        );
        if (numAmount > userUsdcBalance) {
          return `Insufficient USDC balance. Available: $${formatExactUSDC(userUsdcBalance)}`;
        }
      }
    } else {
      // Basic withdraw validation
      if (numAmount < 1) return "Minimum withdrawal is $1";

      if (numAmount > accountMetrics.freeMargin) {
        return `Insufficient free margin. Available: $${formatExactUSDC(accountMetrics.freeMargin)}`;
      }
    }

    return null;
  }, [amount, activeTab, optimizedUsdcBalance, accountMetrics.freeMargin]);

  // Get maximum available amount for current tab
  const getMaxAmount = useCallback(() => {
    if (activeTab === "deposit") {
      return optimizedUsdcBalance
        ? parseFloat(formatUnits(optimizedUsdcBalance as bigint, 6))
        : 0;
    } else {
      return accountMetrics.freeMargin;
    }
  }, [activeTab, optimizedUsdcBalance, accountMetrics.freeMargin]);

  // Check if approval is needed for deposit
  const needsApproval = useCallback(() => {
    if (activeTab !== "deposit" || !amount || usdcAllowance === undefined) {
      return false;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return false;
    }

    const allowance = parseFloat(formatUnits(usdcAllowance as bigint, 6));
    return numAmount > allowance;
  }, [activeTab, amount, usdcAllowance]);

  // Handle approve USDC using the trade service
  const handleApprove = useCallback(async () => {
    if (!amount || !usdcContract || !storeContract) return;

    setIsProcessing(true);
    setCurrentOperation("approve");
    toast.loading(`Preparing to deposit $${amount} USDC...`);

    try {
      // TODO: Implement approval via API
      await approveUSDC();
    } catch (error) {
      toast.dismiss();
      toast.error(
        `Failed to prepare deposit: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      setIsProcessing(false);
      setCurrentOperation(null);
    }
  }, [amount, approveUSDC, usdcContract, storeContract]);

  // Handle deposit using the trade service
  const handleDeposit = useCallback(async () => {
    if (!amount) return;

    setIsProcessing(true);
    setCurrentOperation("deposit");
    toast.loading(`Depositing $${amount} USDC to protocol...`);

    try {
      await depositUSDC();
    } catch (error) {
      toast.dismiss();
      toast.error(
        `Failed to deposit USDC: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      setIsProcessing(false);
      setCurrentOperation(null);
    }
  }, [amount, depositUSDC]);

  // Handle withdraw using the trade service
  const handleWithdraw = useCallback(async () => {
    if (!amount) return;

    setIsProcessing(true);
    setCurrentOperation("withdraw");
    toast.loading(`Withdrawing $${amount} USDC from protocol...`);

    try {
      await withdrawUSDC();
    } catch (error) {
      toast.dismiss();
      toast.error(
        `Failed to withdraw USDC: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      setIsProcessing(false);
      setCurrentOperation(null);
    }
  }, [amount, withdrawUSDC]);

  // Handle main action - seamless approve + deposit or direct deposit/withdraw
  const handleAction = useCallback(async () => {
    if (!isValidAmount) {
      return;
    }

    if (activeTab === "deposit") {
      const needsApprovalCheck = needsApproval();

      if (needsApprovalCheck) {
        // Start approval process - deposit will happen automatically after approval
        await handleApprove();
      } else {
        // Direct deposit if allowance is sufficient
        await handleDeposit();
      }
    } else {
      await handleWithdraw();
    }
  }, [
    isValidAmount,
    activeTab,
    needsApproval,
    handleApprove,
    handleDeposit,
    handleWithdraw,
  ]);

  // Handle transaction errors from trade service
  useEffect(() => {
    if (tradeServiceError) {
      toast.dismiss();

      // Show user-friendly error message
      let errorMessage = "Transaction failed";
      const errorMsg = tradeServiceError?.message?.toLowerCase() || "";

      if (
        errorMsg.includes("allowance") ||
        errorMsg.includes("erc20: transfer amount exceeds allowance")
      ) {
        errorMessage =
          "The contract doesn't have permission to spend your USDC. Try approving again.";
      } else if (errorMsg.includes("insufficient")) {
        errorMessage = "Insufficient balance or gas";
      } else if (errorMsg.includes("rejected")) {
        errorMessage = "Transaction rejected by user";
      } else if (errorMsg.includes("revert")) {
        errorMessage = `Contract error: ${tradeServiceError?.message}`;
      }

      toast.error(errorMessage, {
        duration: 10000,
        position: "top-right",
      });

      // Reset processing state
      setIsProcessing(false);
      setCurrentOperation(null);
    }
  }, [tradeServiceError]);

  // Handle successful transactions
  useEffect(() => {
    if (isSuccess && transactionHash && currentOperation) {
      // Prevent duplicate toasts for the same transaction
      if (lastTransactionHashRef.current === transactionHash) {
        return;
      }
      lastTransactionHashRef.current = transactionHash;

      toast.dismiss();

      const operationType = currentOperation;
      // Capture amount at the time of transaction
      const transactionAmount = amount;

      if (operationType === "approve") {
        toast.success(`Approval successful! Proceeding with deposit...`, {
          duration: 5000,
          position: "top-right",
        });

        // Automatically proceed with deposit after approval
        setTimeout(async () => {
          await refetchUsdcAllowance();
          setTimeout(async () => {
            await handleDeposit();
          }, 500);
        }, 1000);
      } else if (operationType === "deposit") {
        setIsProcessing(false);
        setAmount("");
        setShowBalanceActions(false);
        toast.success(
          `Successfully deposited $${transactionAmount} USDC to protocol`,
          {
            duration: 10000,
            position: "top-right",
          }
        );
      } else if (operationType === "withdraw") {
        setIsProcessing(false);
        setAmount("");
        setShowBalanceActions(false);
        toast.success(
          `Successfully withdrew $${transactionAmount} USDC from protocol`,
          {
            duration: 10000,
            position: "top-right",
          }
        );
      }

      // Refresh balances using optimized data refresh
      setTimeout(() => {
        refreshAccountData();
        refetchUsdcAllowance();
        setCurrentOperation(null);
      }, 1000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isSuccess,
    transactionHash,
    currentOperation,
    chainId,
    refreshAccountData,
    refetchUsdcAllowance,
    handleDeposit,
  ]);

  // Reset amount when switching tabs
  useEffect(() => {
    setAmount("");
  }, [activeTab]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts when the balance dropdown is open
      if (!showBalanceActions) return;

      // Enter key to submit
      if (event.key === "Enter" && isValidAmount) {
        event.preventDefault();
        handleAction();
      }

      // Escape key to close
      if (event.key === "Escape") {
        event.preventDefault();
        setShowBalanceActions(false);
      }

      // Tab key to switch between deposit/withdraw
      if (event.key === "Tab" && event.shiftKey) {
        event.preventDefault();
        setActiveTab(activeTab === "deposit" ? "withdraw" : "deposit");
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showBalanceActions, isValidAmount, handleAction, activeTab]);

  return (
    <div className={`relative ${className}`} ref={balanceRef}>
      <div className="group border-border bg-background-card hover:border-accent flex items-center justify-between rounded-lg border px-3 py-2 transition-all duration-300">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-white">
            {isConnected ? (
              isAccountDataLoading ? (
                <div className="flex items-center space-x-2">
                  <span>$</span>
                  <div className="bg-background-elevated h-3 w-12 animate-pulse rounded"></div>
                </div>
              ) : (
                formatBalance(getTotalBalance())
              )
            ) : (
              "$0.00"
            )}
          </span>
          <span className="text-xs text-[#A3B8D9]">
            Total Balance
            {isConnected && isAccountDataLoading && (
              <span className="ml-1 text-[#3A8DFF]">• Loading</span>
            )}
          </span>
        </div>

        {isMounted && isConnected && (
          <button
            onClick={() => setShowBalanceActions(!showBalanceActions)}
            className="border-border bg-background-elevated hover:border-accent hover:bg-accent/10 flex h-7 w-7 items-center justify-center rounded-md border transition-all duration-200 active:scale-95"
            title="Manage Balance"
          >
            <Plus
              className={`h-3.5 w-3.5 text-[#A3B8D9] transition-all duration-200 group-hover:text-white ${
                showBalanceActions ? "rotate-45" : ""
              }`}
            />
          </button>
        )}
      </div>

      {/* Balance Actions Dropdown - Account Panel */}
      {showBalanceActions && isMounted && isConnected && (
        <div className="border-border bg-background-card absolute top-full right-0 z-50 mt-2 w-72 overflow-hidden rounded-xl border">
          {/* Header */}
          <div className="border-border bg-background-card border-b px-4 py-3">
            <h3 className="text-sm font-semibold text-white">
              Account Overview
            </h3>
          </div>

          {/* Account Details */}
          <div className="p-4">
            {/* Trading Metrics */}
            <div className="mb-4 grid grid-cols-2 gap-3">
              {/* U/PL */}
              <div className="border-border-muted bg-background-elevated rounded-lg border p-3">
                <div className="mb-1 text-xs font-medium tracking-wide text-[#A3B8D9]">
                  U-PnL
                </div>
                <div
                  className={`text-sm font-semibold ${
                    accountMetrics.upl >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {accountMetrics.upl >= 0 ? "+" : ""}$
                  {formatAvailableBalance(Math.abs(accountMetrics.upl))}
                </div>
              </div>

              {/* Available for Trading */}
              <div className="border-accent/30 bg-accent/5 rounded-lg border p-3">
                <div className="mb-1 text-xs font-medium tracking-wide text-[#3A8DFF] uppercase">
                  avbl.
                </div>
                <div
                  className={`text-sm font-bold ${
                    accountMetrics.freeMargin > 100
                      ? "text-green-400"
                      : accountMetrics.freeMargin > 50
                        ? "text-yellow-400"
                        : "text-red-400"
                  }`}
                >
                  ${formatAvailableBalance(accountMetrics.freeMargin)}
                </div>
              </div>
            </div>

            {/* Margin Health - Only when there are positions */}
            {accountMetrics.lockedMargin > 0 && (
              <div className="border-border-muted bg-background-elevated mb-4 rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-[#A3B8D9]">
                    Margin Usage
                  </span>
                  <span
                    className={`text-sm font-semibold ${
                      accountMetrics.marginLevel > 300
                        ? "text-green-400"
                        : accountMetrics.marginLevel > 150
                          ? "text-yellow-400"
                          : "text-red-400"
                    }`}
                  >
                    {formatMarginLevel(accountMetrics.marginLevel)}
                  </span>
                </div>
                <div className="mb-2 text-xs text-[#A3B8D9]">
                  Used: ${formatAvailableBalance(accountMetrics.lockedMargin)}
                </div>
                <div className="bg-background-elevated h-1.5 w-full rounded-full">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      accountMetrics.marginLevel > 300
                        ? "bg-linear-to-r from-green-400 to-green-500"
                        : accountMetrics.marginLevel > 150
                          ? "bg-linear-to-r from-yellow-400 to-yellow-500"
                          : "bg-linear-to-r from-red-400 to-red-500"
                    }`}
                    style={{
                      width: `${Math.min(100, Math.max(5, (accountMetrics.marginLevel / 400) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Deposit/Withdraw Actions */}
          <div className="border-border bg-background-elevated border-t p-4">
            {/* Tab Selector */}
            <div className="bg-background mb-3 grid grid-cols-2 gap-1 rounded-lg p-1">
              <button
                onClick={() => setActiveTab("deposit")}
                className={`rounded-md px-3 py-2 text-xs font-semibold transition-all duration-200 ${
                  activeTab === "deposit"
                    ? "border border-green-500 bg-green-600/10 text-green-400"
                    : "text-[#A3B8D9] hover:text-white"
                }`}
              >
                Deposit
              </button>
              <button
                onClick={() => setActiveTab("withdraw")}
                className={`rounded-md px-3 py-2 text-xs font-semibold transition-all duration-200 ${
                  activeTab === "withdraw"
                    ? "border border-red-500 bg-red-600/10 text-red-400"
                    : "text-[#A3B8D9] hover:text-white"
                }`}
              >
                Withdraw
              </button>
            </div>

            {/* Amount Input Section */}
            <div className="mb-3">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-medium text-[#A3B8D9]">
                  Amount (USDC)
                </label>
                <span className="text-xs text-[#A3B8D9]/70">
                  avbl: ${formatExactUSDC(getMaxAmount())}
                </span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.000000"
                  className={`w-full rounded-lg border px-3 py-2 pr-12 text-white placeholder-[#A3B8D9]/50 transition-all duration-200 focus:ring-1 focus:outline-none ${
                    getValidationMessage()
                      ? "border-negative bg-negative/5 focus:border-negative focus:ring-negative/25"
                      : "border-border bg-background-elevated focus:border-accent focus:ring-accent/25"
                  }`}
                  step="0.000001"
                  min="0"
                  max={getMaxAmount()}
                />
                <div className="absolute top-1/2 right-3 -translate-y-1/2 transform text-xs font-medium text-[#A3B8D9]/70">
                  USDC
                </div>
              </div>
              {/* Validation Message */}
              {getValidationMessage() && (
                <p className="animate-in fade-in-0 mt-1 text-xs text-red-400 duration-200">
                  {getValidationMessage()}
                </p>
              )}
            </div>

            {/* Quick Amount Buttons */}
            <div className="mb-3 grid grid-cols-3 gap-2">
              {activeTab === "deposit" ? (
                <>
                  <button
                    onClick={() =>
                      setAmount(formatExactUSDC(Math.min(100, getMaxAmount())))
                    }
                    disabled={getMaxAmount() < 100}
                    className="border-border bg-background-elevated text-foreground-muted hover:bg-background-hover rounded-lg border px-2 py-1.5 text-xs font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    $100
                  </button>
                  <button
                    onClick={() =>
                      setAmount(formatExactUSDC(Math.min(500, getMaxAmount())))
                    }
                    disabled={getMaxAmount() < 500}
                    className="border-border bg-background-elevated text-foreground-muted hover:bg-background-hover rounded-lg border px-2 py-1.5 text-xs font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    $500
                  </button>
                  <button
                    onClick={() => setAmount(formatExactUSDC(getMaxAmount()))}
                    disabled={getMaxAmount() <= 0}
                    className="border-border bg-background-elevated text-foreground-muted hover:bg-background-hover rounded-lg border px-2 py-1.5 text-xs font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Max
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() =>
                      setAmount(
                        formatExactUSDC(accountMetrics.freeMargin * 0.25)
                      )
                    }
                    disabled={accountMetrics.freeMargin <= 0}
                    className="border-border bg-background-elevated text-foreground-muted hover:bg-background-hover rounded-lg border px-2 py-1.5 text-xs font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    25%
                  </button>
                  <button
                    onClick={() =>
                      setAmount(
                        formatExactUSDC(accountMetrics.freeMargin * 0.5)
                      )
                    }
                    disabled={accountMetrics.freeMargin <= 0}
                    className="border-border bg-background-elevated text-foreground-muted hover:bg-background-hover rounded-lg border px-2 py-1.5 text-xs font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    50%
                  </button>
                  <button
                    onClick={() =>
                      setAmount(formatExactUSDC(accountMetrics.freeMargin))
                    }
                    disabled={accountMetrics.freeMargin <= 0}
                    className="border-border bg-background-elevated text-foreground-muted hover:bg-background-hover rounded-lg border px-2 py-1.5 text-xs font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Max
                  </button>
                </>
              )}
            </div>

            {/* Action Button Section */}
            <div>
              {/* Approval Status for Deposits */}
              {activeTab === "deposit" && amount && needsApproval() && (
                <div className="mb-3">
                  <div className="rounded-lg border border-yellow-500/30 bg-linear-to-r from-yellow-500/10 to-yellow-600/10 p-3">
                    <div className="flex items-center space-x-2">
                      <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
                      <p className="text-xs font-medium text-yellow-300">
                        Approval required before deposit
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-yellow-200/80">
                      This will approve unlimited USDC transfers for future
                      deposits
                    </p>
                  </div>
                </div>
              )}

              {/* Main Action Button */}
              <button
                onClick={handleAction}
                disabled={
                  !isValidAmount ||
                  isProcessing ||
                  isPending ||
                  getMaxAmount() <= 0
                }
                className={`w-full rounded-lg px-3 py-2.5 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
                  activeTab === "deposit"
                    ? "border border-green-500 bg-green-600/20 text-green-300 hover:border-green-400 hover:bg-green-600/30 disabled:hover:border-green-500 disabled:hover:bg-green-600/20"
                    : "border border-red-500 bg-red-600/20 text-red-300 hover:border-red-400 hover:bg-red-600/30 disabled:hover:border-red-500 disabled:hover:bg-red-600/20"
                }`}
              >
                {isProcessing || isPending ? (
                  <div className="flex items-center justify-center space-x-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>
                      {currentOperation === "approve"
                        ? "Approving..."
                        : currentOperation === "deposit"
                          ? "Depositing..."
                          : "Withdrawing..."}
                    </span>
                  </div>
                ) : !isValidAmount ? (
                  <span className="opacity-75">
                    {!amount ? `Enter amount` : "Invalid amount"}
                  </span>
                ) : (
                  <span>
                    {activeTab === "deposit"
                      ? needsApproval()
                        ? "Approve & Deposit"
                        : "Deposit"
                      : "Withdraw"}{" "}
                    {amount && `$${amount}`}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
