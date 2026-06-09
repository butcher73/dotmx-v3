import {
  Key,
  Plus,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import {
  PortalCard,
  PortalCardHeader,
  PortalCardTitle,
  PortalCardContent,
} from "@/components/ui";
import type { WhitelistAddress } from "@/services/ApiClient";

interface WhitelistCardProps {
  whitelistEnabled: boolean;
  whitelistAddresses: WhitelistAddress[];
  isLoading: boolean;
  message: { type: "success" | "error"; text: string } | null;
  showAddAddress: boolean;
  newAddress: { label: string; address: string; chain: string };
  isAddingAddress: boolean;
  onToggleWhitelist: () => void;
  onShowAddAddress: (show: boolean) => void;
  onNewAddressChange: (field: string, value: string) => void;
  onAddAddress: () => void;
  onRemoveAddress: (addressId: string) => void;
}

export function WhitelistCard({
  whitelistEnabled,
  whitelistAddresses,
  isLoading,
  message,
  showAddAddress,
  newAddress,
  isAddingAddress,
  onToggleWhitelist,
  onShowAddAddress,
  onNewAddressChange,
  onAddAddress,
  onRemoveAddress,
}: WhitelistCardProps) {
  return (
    <>
      <PortalCard className="border-zinc-800/50 bg-linear-to-br from-zinc-900 to-zinc-900/80">
        <PortalCardHeader>
          <PortalCardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-blue-400" />
            Withdrawal Whitelist
          </PortalCardTitle>
        </PortalCardHeader>
        <PortalCardContent>
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
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
            </div>
          ) : (
            <>
              <div className="mb-6 flex items-center justify-between">
                <div className="flex gap-4">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                      whitelistEnabled
                        ? "bg-emerald-500/10 ring-1 ring-emerald-500/30"
                        : "bg-zinc-800/50"
                    }`}
                  >
                    <Key
                      className={`h-6 w-6 ${whitelistEnabled ? "text-emerald-400" : "text-zinc-500"}`}
                    />
                  </div>
                  <div>
                    <div className="mb-1 font-semibold text-white">
                      Whitelist Status
                    </div>
                    <div className="text-sm text-zinc-400">
                      {whitelistEnabled
                        ? "Only whitelisted addresses can receive withdrawals"
                        : "Allow withdrawals to any address"}
                    </div>
                  </div>
                </div>
                <button
                  onClick={onToggleWhitelist}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    whitelistEnabled
                      ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
                      : "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  {whitelistEnabled ? "Enabled" : "Disabled"}
                </button>
              </div>

              {whitelistEnabled && (
                <>
                  <div className="mb-4 flex items-center justify-between">
                    <div className="text-sm font-medium text-white">
                      Whitelisted Addresses ({whitelistAddresses.length})
                    </div>
                    <button
                      onClick={() => onShowAddAddress(true)}
                      className="flex items-center gap-2 rounded-lg bg-blue-500/10 px-3 py-1.5 text-sm font-medium text-blue-400 ring-1 ring-blue-500/20 hover:bg-blue-500/20"
                    >
                      <Plus className="h-4 w-4" />
                      Add Address
                    </button>
                  </div>

                  {whitelistAddresses.length === 0 ? (
                    <div className="rounded-lg border border-zinc-800/50 bg-zinc-900/50 py-12 text-center">
                      <Key className="mx-auto mb-3 h-12 w-12 text-zinc-600" />
                      <div className="text-sm text-zinc-500">
                        No whitelisted addresses yet
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {whitelistAddresses.map((addr) => (
                        <div
                          key={addr.id}
                          className="flex items-center justify-between rounded-lg border border-zinc-800/50 bg-zinc-900/50 p-4"
                        >
                          <div>
                            <div className="mb-1 font-medium text-white">
                              {addr.label}
                            </div>
                            <div className="mb-1 font-mono text-sm text-zinc-400">
                              {addr.address}
                            </div>
                            <div className="text-xs text-zinc-500">
                              {addr.chain}
                            </div>
                          </div>
                          <button
                            onClick={() => onRemoveAddress(addr.id)}
                            className="rounded-lg bg-red-500/10 p-2 text-red-400 hover:bg-red-500/20"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </PortalCardContent>
      </PortalCard>

      {showAddAddress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-800/50 bg-zinc-900 p-6">
            <h3 className="mb-4 text-lg font-semibold text-white">
              Add Whitelisted Address
            </h3>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">
                  Label
                </label>
                <input
                  type="text"
                  placeholder="My Wallet"
                  value={newAddress.label}
                  onChange={(e) => onNewAddressChange("label", e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2 text-white placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">
                  Address
                </label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={newAddress.address}
                  onChange={(e) =>
                    onNewAddressChange("address", e.target.value)
                  }
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2 font-mono text-white placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">
                  Chain
                </label>
                <select
                  value={newAddress.chain}
                  onChange={(e) => onNewAddressChange("chain", e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="ETH">Ethereum</option>
                  <option value="BTC">Bitcoin</option>
                  <option value="USDT">USDT</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    onShowAddAddress(false);
                    onNewAddressChange("label", "");
                    onNewAddressChange("address", "");
                    onNewAddressChange("chain", "ETH");
                  }}
                  className="flex-1 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
                >
                  Cancel
                </button>
                <button
                  onClick={onAddAddress}
                  disabled={isAddingAddress}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {isAddingAddress ? "Adding..." : "Add"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
