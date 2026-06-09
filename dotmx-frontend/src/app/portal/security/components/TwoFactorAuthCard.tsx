import {
  Smartphone,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Check,
  X,
} from "lucide-react";
import Image from "next/image";
import {
  PortalCard,
  PortalCardHeader,
  PortalCardTitle,
  PortalCardContent,
} from "@/components/ui";
import type {
  TwoFactorStatus,
  TwoFactorSetupResponse,
} from "@/services/ApiClient";

interface TwoFactorAuthCardProps {
  twoFactorStatus: TwoFactorStatus | null;
  isLoading: boolean;
  message: { type: "success" | "error"; text: string } | null;
  show2FASetup: boolean;
  setupData: TwoFactorSetupResponse | null;
  verificationCode: string;
  isVerifying: boolean;
  show2FADisable: boolean;
  disablePassword: string;
  isDisabling: boolean;
  showBackupCodes: boolean;
  copiedCode: boolean;
  onStart2FASetup: () => void;
  onVerify2FA: () => void;
  onDisable2FA: () => void;
  setShow2FASetup: (show: boolean) => void;
  setShow2FADisable: (show: boolean) => void;
  setShowBackupCodes: (show: boolean) => void;
  setVerificationCode: (code: string) => void;
  setDisablePassword: (password: string) => void;
  onCopyToClipboard: (text: string) => void;
}

export function TwoFactorAuthCard({
  twoFactorStatus,
  isLoading,
  message,
  show2FASetup,
  setupData,
  verificationCode,
  isVerifying,
  show2FADisable,
  disablePassword,
  isDisabling,
  showBackupCodes,
  copiedCode,
  onStart2FASetup,
  onVerify2FA,
  onDisable2FA,
  setShow2FASetup,
  setShow2FADisable,
  setShowBackupCodes,
  setVerificationCode,
  setDisablePassword,
  onCopyToClipboard,
}: TwoFactorAuthCardProps) {
  return (
    <>
      <PortalCard className="border-zinc-800/50 bg-linear-to-br from-zinc-900 to-zinc-900/80">
        <PortalCardHeader>
          <PortalCardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-emerald-400" />
            Two-Factor Authentication
          </PortalCardTitle>
        </PortalCardHeader>
        <PortalCardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
            </div>
          ) : (
            <>
              {message && (
                <div
                  className={`mb-4 flex items-center gap-3 rounded-xl p-4 ${
                    message.type === "success"
                      ? "bg-emerald-500/10 ring-1 ring-emerald-500/20"
                      : "bg-red-500/10 ring-1 ring-red-500/20"
                  }`}
                >
                  {message.type === "success" ? (
                    <CheckCircle className="h-5 w-5 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-400" />
                  )}
                  <div className="flex-1">
                    <div
                      className={`text-sm font-semibold ${
                        message.type === "success"
                          ? "text-emerald-400"
                          : "text-red-400"
                      }`}
                    >
                      {message.type === "success" ? "Success!" : "Error"}
                    </div>
                    <div className="text-xs text-zinc-400">{message.text}</div>
                  </div>
                </div>
              )}
              <div className="flex items-start justify-between">
                <div className="flex gap-4">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                      twoFactorStatus?.enabled
                        ? "bg-emerald-500/10 ring-1 ring-emerald-500/30"
                        : "bg-zinc-800/50"
                    }`}
                  >
                    <Smartphone
                      className={`h-6 w-6 ${twoFactorStatus?.enabled ? "text-emerald-400" : "text-zinc-500"}`}
                    />
                  </div>
                  <div>
                    <div className="mb-1 font-semibold text-white">
                      Authenticator App
                    </div>
                    <div className="mb-3 text-sm text-zinc-400">
                      {twoFactorStatus?.enabled
                        ? "2FA is currently enabled"
                        : "Add an extra layer of security"}
                    </div>
                    <div
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                        twoFactorStatus?.enabled
                          ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
                          : "bg-zinc-800/50 text-zinc-400"
                      }`}
                    >
                      {twoFactorStatus?.enabled ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <X className="h-3 w-3" />
                      )}
                      {twoFactorStatus?.enabled ? "Enabled" : "Disabled"}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() =>
                    twoFactorStatus?.enabled
                      ? setShow2FADisable(true)
                      : onStart2FASetup()
                  }
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    twoFactorStatus?.enabled
                      ? "bg-red-500/10 text-red-400 ring-1 ring-red-500/20 hover:bg-red-500/20"
                      : "bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20 hover:bg-blue-500/20"
                  }`}
                >
                  {twoFactorStatus?.enabled ? "Disable" : "Enable"}
                </button>
              </div>
            </>
          )}
        </PortalCardContent>
      </PortalCard>

      {/* Modals remain inline for now but could be extracted further if needed */}
      {show2FASetup && setupData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-800/50 bg-zinc-900 p-6">
            <h3 className="mb-4 text-lg font-semibold text-white">
              Set Up 2FA
            </h3>
            <div className="mb-4 flex justify-center rounded-lg bg-white p-4">
              <Image
                src={setupData.qr_code_url}
                alt="QR Code"
                width={200}
                height={200}
                className="rounded-lg"
              />
            </div>
            <input
              type="text"
              placeholder="Enter 6-digit code"
              value={verificationCode}
              onChange={(e) =>
                setVerificationCode(
                  e.target.value.replace(/\D/g, "").slice(0, 6)
                )
              }
              className="mb-4 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2 text-white placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShow2FASetup(false);
                  setVerificationCode("");
                }}
                className="flex-1 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={onVerify2FA}
                disabled={isVerifying || verificationCode.length !== 6}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {isVerifying ? "Verifying..." : "Verify"}
              </button>
            </div>
          </div>
        </div>
      )}

      {show2FADisable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-800/50 bg-zinc-900 p-6">
            <h3 className="mb-4 text-lg font-semibold text-white">
              Disable 2FA
            </h3>
            <p className="mb-4 text-sm text-zinc-400">
              Enter your password to confirm
            </p>
            <input
              type="password"
              placeholder="Password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              className="mb-4 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2 text-white placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShow2FADisable(false);
                  setDisablePassword("");
                }}
                className="flex-1 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={onDisable2FA}
                disabled={isDisabling}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {isDisabling ? "Disabling..." : "Disable"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBackupCodes && setupData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-800/50 bg-zinc-900 p-6">
            <h3 className="mb-4 text-lg font-semibold text-white">
              Backup Codes
            </h3>
            <p className="mb-4 text-sm text-zinc-400">
              Save these codes in a secure location
            </p>
            <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg bg-zinc-800/50 p-4">
              {setupData.backup_codes.map((code: string, idx: number) => (
                <div
                  key={idx}
                  className="rounded bg-zinc-900 px-3 py-2 text-center font-mono text-sm text-white"
                >
                  {code}
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                onCopyToClipboard(setupData.backup_codes.join("\n"));
                setTimeout(() => setShowBackupCodes(false), 1000);
              }}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
            >
              {copiedCode ? "Copied!" : "Copy All"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
