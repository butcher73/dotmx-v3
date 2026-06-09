"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  apiClient,
  type ApiKey,
  type CreateApiKeyResponse,
} from "@/services/ApiClient";
import {
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  AlertTriangle,
  Clock,
  Loader2,
} from "lucide-react";
import {
  PortalCard,
  PortalCardContent,
  PortalPageLayout,
  PortalPageHeader,
  Alert,
} from "@/components/ui";

// Extended type for newly created keys (includes the full secret)
interface DisplayApiKey extends ApiKey {
  full_api_key?: string; // Only available immediately after creation
}

export default function ApiKeysPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [apiKeys, setApiKeys] = useState<DisplayApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newlyCreatedKey, setNewlyCreatedKey] =
    useState<CreateApiKeyResponse | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // Load API keys from backend
  useEffect(() => {
    const loadApiKeys = async () => {
      try {
        setError(null);
        const keys = await apiClient.getApiKeys();
        setApiKeys(keys);
      } catch (err) {
        console.error("Failed to load API keys:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load API keys";
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    if (isAuthenticated) {
      loadApiKeys();
    }
  }, [isAuthenticated]);

  // Handle create API key
  const handleCreateApiKey = async () => {
    if (!newKeyName || selectedPermissions.length === 0) return;

    setIsCreating(true);
    setError(null);

    try {
      const response = await apiClient.createApiKey({
        name: newKeyName,
        scopes: selectedPermissions,
      });

      // Add the new key to the list
      setApiKeys((prev) => [
        { ...response.key, full_api_key: response.api_key },
        ...prev,
      ]);
      setNewlyCreatedKey(response);
      setNewKeyName("");
      setSelectedPermissions([]);
      setShowCreateModal(false);
    } catch (err) {
      console.error("Failed to create API key:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to create API key";
      setError(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  // Handle revoke API key
  const handleRevokeApiKey = async (keyId: string) => {
    try {
      setError(null);
      await apiClient.revokeApiKey(keyId);
      setApiKeys((prev) => prev.filter((k) => k.id !== keyId));
    } catch (err) {
      console.error("Failed to revoke API key:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to revoke API key";
      setError(errorMessage);
    }
  };

  const permissions = [
    {
      id: "read",
      label: "Read",
      description: "View account balances and positions",
    },
    {
      id: "trade",
      label: "Trade",
      description: "Place, modify, and cancel orders",
    },
    { id: "withdraw", label: "Withdraw", description: "Initiate withdrawals" },
  ];

  const copyToClipboard = (text: string, keyId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const togglePermission = (permId: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permId)
        ? prev.filter((p) => p !== permId)
        : [...prev, permId]
    );
  };

  if (authLoading || isLoading) {
    return (
      <PortalPageLayout>
        <div className="mb-6">
          <div className="bg-border mb-1.5 h-6 w-32 animate-pulse rounded" />
          <div className="bg-border h-4 w-48 animate-pulse rounded" />
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="text-accent h-8 w-8 animate-spin" />
        </div>
      </PortalPageLayout>
    );
  }

  return (
    <PortalPageLayout>
      <div className="mb-6 flex items-center justify-between">
        <PortalPageHeader
          title="API Keys"
          description="Manage your API keys for programmatic access"
        />
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-accent hover:bg-accent-hover text-foreground flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          Create API Key
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert
          variant="error"
          icon={AlertTriangle}
          message={error}
          className="mb-6"
        />
      )}

      {/* Warning */}
      <div
        className="bg-warning-muted border-warning/30 mb-6 flex items-start gap-3 rounded-lg p-4"
        style={{ border: "1px solid rgba(234, 179, 8, 0.3)" }}
      >
        <AlertTriangle className="text-warning mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <div className="text-warning text-sm font-medium">
            Keep your API keys secure
          </div>
          <p className="text-warning/80 mt-1 text-xs">
            Never share your secret key with anyone. dotMX will never ask for
            your secret key. If you suspect your key has been compromised,
            disable it immediately.
          </p>
        </div>
      </div>

      {/* API Keys List */}
      <div className="space-y-4">
        {apiKeys.length === 0 ? (
          <PortalCard>
            <PortalCardContent className="py-12 text-center">
              <Key className="text-border-accent mx-auto mb-2 h-10 w-10" />
              <p className="text-foreground-subtle text-sm">
                No API keys created
              </p>
              <p className="text-foreground-subtle mt-1 text-xs">
                Create an API key to start integrating with dotMX
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-accent hover:bg-accent-hover text-foreground mt-4 rounded px-4 py-2 text-sm font-medium"
              >
                Create API Key
              </button>
            </PortalCardContent>
          </PortalCard>
        ) : (
          apiKeys.map((key) => (
            <PortalCard key={key.id}>
              <PortalCardContent>
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-border flex h-10 w-10 items-center justify-center rounded-sm">
                      <Key className="text-foreground-muted h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-foreground text-sm font-medium">
                        {key.name}
                      </div>
                      <div className="text-foreground-subtle flex items-center gap-2 text-xs">
                        <Clock className="h-3 w-3" />
                        Created {new Date(key.created_at).toLocaleDateString()}
                        {key.last_used_at && (
                          <>
                            {" "}
                            • Last used{" "}
                            {new Date(key.last_used_at).toLocaleDateString()}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xs bg-positive-muted text-positive rounded px-2 py-1 font-medium">
                      Active
                    </span>
                    <button
                      onClick={() => handleRevokeApiKey(key.id)}
                      className="text-negative hover:text-negative/80 rounded p-1.5"
                      title="Revoke API key"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* API Key */}
                <div className="mb-3">
                  <label className="text-foreground-muted mb-1 block text-xs">
                    API Key
                  </label>
                  <div className="bg-background flex items-center justify-between rounded-lg px-3 py-2">
                    <code className="text-foreground text-xs">
                      {key.full_api_key || `${key.key_prefix}...`}
                    </code>
                    {key.full_api_key && (
                      <button
                        onClick={() =>
                          copyToClipboard(key.full_api_key!, `api-${key.id}`)
                        }
                        className="text-foreground-muted hover:text-foreground ml-2"
                      >
                        {copiedKey === `api-${key.id}` ? (
                          <Check className="text-positive h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                  {!key.full_api_key && (
                    <p className="text-foreground-subtle text-2xs mt-1">
                      Full key only shown once at creation
                    </p>
                  )}
                </div>

                {/* Scopes/Permissions */}
                <div className="flex flex-wrap items-center gap-4 border-t border-[#333] pt-4">
                  <div>
                    <span className="text-foreground-muted mr-2 text-xs">
                      Permissions:
                    </span>
                    {key.scopes.map((scope) => (
                      <span
                        key={scope}
                        className="bg-border text-foreground-muted text-2xs mr-1 rounded px-2 py-0.5 capitalize"
                      >
                        {scope}
                      </span>
                    ))}
                  </div>
                  {key.expires_at && (
                    <div className="flex items-center gap-1">
                      <Clock className="text-foreground-muted h-3 w-3" />
                      <span className="text-foreground-muted text-xs">
                        Expires: {new Date(key.expires_at).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </PortalCardContent>
            </PortalCard>
          ))
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background-card mx-4 w-full max-w-md rounded-xl border border-[#333] p-6">
            <h2 className="text-foreground mb-4 text-lg font-bold">
              Create API Key
            </h2>

            <div className="mb-4">
              <label className="text-foreground-muted mb-1 block text-xs">
                Key Name
              </label>
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="bg-background text-foreground w-full rounded-lg px-3 py-2 text-sm"
                placeholder="e.g., Trading Bot"
              />
            </div>

            <div className="mb-4">
              <label className="text-foreground-muted mb-2 block text-xs">
                Permissions
              </label>
              <div className="space-y-2">
                {permissions.map((perm) => (
                  <label
                    key={perm.id}
                    className="hover:border-accent/50 flex cursor-pointer items-start gap-3 rounded-lg p-3"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPermissions.includes(perm.id)}
                      onChange={() => togglePermission(perm.id)}
                      className="accent-accent mt-0.5"
                    />
                    <div>
                      <div className="text-foreground text-sm font-medium">
                        {perm.label}
                      </div>
                      <div className="text-foreground-subtle text-xs">
                        {perm.description}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewKeyName("");
                  setSelectedPermissions([]);
                }}
                disabled={isCreating}
                className="text-foreground-muted hover:text-foreground rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateApiKey}
                disabled={
                  isCreating || !newKeyName || selectedPermissions.length === 0
                }
                className="bg-accent hover:bg-accent-hover text-foreground flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Newly Created Key Modal */}
      {newlyCreatedKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background-card mx-4 w-full max-w-md rounded-xl border border-[#333] p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="bg-positive-muted flex h-10 w-10 items-center justify-center rounded-full">
                <Check className="text-positive h-5 w-5" />
              </div>
              <div>
                <h2 className="text-foreground text-lg font-bold">
                  API Key Created
                </h2>
                <p className="text-foreground-muted text-sm">
                  Save this key now - you won&apos;t see it again!
                </p>
              </div>
            </div>

            <div className="bg-warning-muted border-warning/30 mb-4 rounded-lg p-3">
              <div className="text-warning flex items-start gap-2 text-xs">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Copy your API key now. For security reasons, you will not be
                  able to see it again.
                </span>
              </div>
            </div>

            <div className="mb-4">
              <label className="text-foreground-muted mb-1 block text-xs">
                API Key
              </label>
              <div className="bg-background flex items-center justify-between rounded-lg px-3 py-2">
                <code className="text-foreground text-xs break-all">
                  {newlyCreatedKey.api_key}
                </code>
                <button
                  onClick={() =>
                    copyToClipboard(newlyCreatedKey.api_key, "new-key")
                  }
                  className="text-foreground-muted hover:text-foreground ml-2 shrink-0"
                >
                  {copiedKey === "new-key" ? (
                    <Check className="text-positive h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              onClick={() => setNewlyCreatedKey(null)}
              className="bg-accent hover:bg-accent-hover text-foreground w-full rounded-lg px-4 py-2 text-sm font-medium"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </PortalPageLayout>
  );
}
