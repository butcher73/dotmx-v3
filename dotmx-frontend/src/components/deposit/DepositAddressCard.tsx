"use client";

import { useState } from "react";
import { Copy, Check, AlertCircle, Info } from "lucide-react";
import {
  PortalCard,
  PortalCardContent,
  PortalCardHeader,
  PortalCardTitle,
  Alert,
} from "@/components/ui";
import { DepositAddress } from "@/services/ApiClient";
import { formatCryptoAmount } from "@/utils/formatting";
import { QRCodeDisplay } from "./QRCodeDisplay";
import { isEVMNetwork } from "./utils";

interface DepositAddressCardProps {
  depositAddress: DepositAddress;
  selectedToken: string;
  minDeposit?: string;
}

export const DepositAddressCard = ({
  depositAddress,
  selectedToken,
  minDeposit,
}: DepositAddressCardProps) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <PortalCard>
      <PortalCardHeader>
        <PortalCardTitle>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-sm font-bold text-emerald-400">
              ✓
            </div>
            Your Deposit Address
          </div>
        </PortalCardTitle>
      </PortalCardHeader>
      <PortalCardContent>
        <div className="space-y-6">
          {/* Main Deposit Section - Prominent */}
          <div className="border-primary/20 bg-primary/5 rounded-xl border-2 p-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="bg-primary/20 text-primary flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold">
                1
              </div>
              <h3 className="text-foreground text-lg font-bold">
                Send {selectedToken} to This Address
              </h3>
            </div>

            <div className="flex flex-col items-center gap-6 sm:flex-row">
              {/* QR Code */}
              <div className="shrink-0">
                <QRCodeDisplay qrData={depositAddress.qr_data} size={200} />
              </div>

              {/* Deposit Address - Large and Clear */}
              <div className="flex-1 space-y-4">
                <div>
                  <label className="text-foreground-muted mb-3 block text-xs font-semibold tracking-wide uppercase">
                    Your Deposit Address
                  </label>
                  <div className="flex items-center gap-2">
                    <code className="border-primary/30 bg-background text-foreground flex-1 rounded-lg border-2 px-4 py-3 font-mono text-base font-semibold break-all">
                      {depositAddress.address}
                    </code>
                    <button
                      onClick={() => copyToClipboard(depositAddress.address)}
                      className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 transition-all"
                    >
                      {copied ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <Copy className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                  {depositAddress.explorer_url && (
                    <a
                      href={`${depositAddress.explorer_url}/address/${depositAddress.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary-hover mt-2 inline-flex items-center gap-1 text-sm font-medium transition-colors"
                    >
                      View on Block Explorer →
                    </a>
                  )}
                </div>

                <div className="bg-background/50 grid grid-cols-2 gap-4 rounded-lg p-3">
                  <div>
                    <div className="text-foreground-muted mb-1 text-xs font-medium uppercase">
                      Token
                    </div>
                    <div className="text-foreground text-sm font-semibold">
                      {selectedToken}
                    </div>
                  </div>
                  <div>
                    <div className="text-foreground-muted mb-1 text-xs font-medium uppercase">
                      Network
                    </div>
                    <div className="text-foreground text-sm font-semibold">
                      {depositAddress.network_name}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {depositAddress.memo && (
              <div className="mt-4">
                <label className="text-foreground-muted mb-2 block text-xs font-semibold tracking-wide uppercase">
                  Memo/Tag (Required)
                </label>
                <div className="flex items-center gap-2">
                  <code className="border-border bg-background text-foreground flex-1 rounded-lg border px-3 py-2.5 font-mono text-sm break-all">
                    {depositAddress.memo}
                  </code>
                  <button
                    onClick={() => copyToClipboard(depositAddress.memo || "")}
                    className="border-border bg-background-elevated text-foreground-muted hover:border-primary hover:text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-all"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Token Contract Info - Secondary Section */}
          {depositAddress.token_contract_address &&
            !depositAddress.is_native_token && (
              <div className="border-border bg-background-elevated rounded-lg border p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Info className="text-foreground-muted h-4 w-4" />
                  <h4 className="text-foreground-muted text-sm font-semibold uppercase">
                    Token Contract Information
                  </h4>
                </div>
                <div className="text-foreground-muted mb-2 text-xs">
                  This is the {selectedToken} token contract address on{" "}
                  {depositAddress.network_name}. This is NOT your deposit
                  address.
                </div>
                <div className="flex items-center gap-2">
                  <code className="border-border bg-background text-foreground-muted flex-1 rounded-lg border px-3 py-2 font-mono text-xs break-all">
                    {depositAddress.token_contract_address}
                  </code>
                  <button
                    onClick={() =>
                      copyToClipboard(depositAddress.token_contract_address!)
                    }
                    className="border-border bg-background text-foreground-muted hover:border-primary hover:text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-all"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
                {depositAddress.explorer_url && (
                  <a
                    href={`${depositAddress.explorer_url}/token/${depositAddress.token_contract_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground-muted hover:text-foreground mt-2 inline-flex items-center gap-1 text-xs transition-colors"
                  >
                    View Token Contract →
                  </a>
                )}
              </div>
            )}

          <p className="text-foreground-muted text-center text-xs">
            Address generated on{" "}
            {new Date(depositAddress.created_at).toLocaleDateString()}
          </p>

          {/* How it works */}
          <div className="border-border bg-background-elevated rounded-lg border p-4">
            <h4 className="text-foreground mb-3 font-semibold">How it works</h4>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex items-start gap-3">
                <div className="bg-primary text-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-semibold">
                  1
                </div>
                <div>
                  <p className="text-foreground font-medium">Send tokens</p>
                  <p className="text-foreground-muted text-xs">
                    Transfer to the address above
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-primary text-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-semibold">
                  2
                </div>
                <div>
                  <p className="text-foreground font-medium">
                    Wait for confirmations
                  </p>
                  <p className="text-foreground-muted text-xs">
                    Network will confirm transaction
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-primary text-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-semibold">
                  3
                </div>
                <div>
                  <p className="text-foreground font-medium">Auto-credited</p>
                  <p className="text-foreground-muted text-xs">
                    Swept to vault & credited
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Network Info */}
          {minDeposit && (
            <div className="grid grid-cols-2 gap-4 rounded-lg border border-zinc-800/50 bg-zinc-900/50 p-4">
              <div>
                <div className="mb-1 text-xs text-zinc-500">Network</div>
                <div className="font-semibold text-white">
                  {depositAddress.network_name}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs text-zinc-500">Min. Deposit</div>
                <div className="font-semibold text-white">
                  {formatCryptoAmount(minDeposit)} {selectedToken}
                </div>
              </div>
            </div>
          )}

          {/* Warning */}
          <Alert variant="warning">
            <AlertCircle className="h-4 w-4" />
            <div className="text-sm">
              <div className="mb-1 font-semibold">Important Notice</div>
              <div className="text-xs">
                Only send {selectedToken} to this address on{" "}
                {depositAddress.network_name}. Sending other assets or using
                wrong network will result in permanent loss.
                {depositAddress.memo &&
                  " Don't forget to include the memo/tag!"}
              </div>
            </div>
          </Alert>

          {/* EVM Address Sharing Info */}
          {isEVMNetwork(depositAddress.network_code) && (
            <Alert variant="info">
              <Info className="h-4 w-4" />
              <div className="text-sm">
                <div className="mb-1 font-semibold">
                  Single Address for All EVM Tokens
                </div>
                <div className="text-xs">
                  This address works for <strong>all tokens</strong> on{" "}
                  {depositAddress.network_name}. You can deposit USDT, USDC,
                  DUSD, or any other supported token to this same address. Our
                  system automatically detects and credits the correct token to
                  your account.
                </div>
              </div>
            </Alert>
          )}
        </div>
      </PortalCardContent>
    </PortalCard>
  );
};
