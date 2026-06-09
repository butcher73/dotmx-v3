import { useState, useEffect } from "react";
import { apiClient, type WhitelistAddress } from "@/services/ApiClient";

export function useWhitelist(isAuthenticated: boolean) {
  const [whitelistEnabled, setWhitelistEnabled] = useState(false);
  const [whitelistAddresses, setWhitelistAddresses] = useState<
    WhitelistAddress[]
  >([]);
  const [isLoadingWhitelist, setIsLoadingWhitelist] = useState(true);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({
    label: "",
    address: "",
    chain: "ETH",
  });
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [whitelistMessage, setWhitelistMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Load whitelist
  useEffect(() => {
    if (!isAuthenticated) return;
    const loadWhitelist = async () => {
      try {
        const data = await apiClient.getWhitelist();
        setWhitelistEnabled(data.enabled);
        setWhitelistAddresses(data.addresses);
      } catch (error) {
        console.error("Failed to load whitelist:", error);
      } finally {
        setIsLoadingWhitelist(false);
      }
    };
    loadWhitelist();
  }, [isAuthenticated]);

  const handleToggleWhitelist = async () => {
    const newState = !whitelistEnabled;
    try {
      await apiClient.toggleWhitelist(newState);
      setWhitelistEnabled(newState);
      setWhitelistMessage({
        type: "success",
        text: newState ? "Whitelist enabled" : "Whitelist disabled",
      });
    } catch (error) {
      console.error("Failed to toggle whitelist:", error);
      setWhitelistMessage({
        type: "error",
        text: "Failed to update whitelist",
      });
    }
  };

  const handleAddAddress = async () => {
    if (!newAddress.label || !newAddress.address) {
      setWhitelistMessage({ type: "error", text: "Fill in all fields" });
      return;
    }
    setIsAddingAddress(true);
    setWhitelistMessage(null);
    try {
      const result = await apiClient.addWhitelistAddress(newAddress);
      setWhitelistAddresses((prev) => [result.address, ...prev]);
      setNewAddress({ label: "", address: "", chain: "ETH" });
      setShowAddAddress(false);
      setWhitelistMessage({ type: "success", text: "Address added" });
    } catch (error) {
      console.error("Failed to add address:", error);
      setWhitelistMessage({ type: "error", text: "Failed to add address" });
    } finally {
      setIsAddingAddress(false);
    }
  };

  const handleRemoveAddress = async (addressId: string) => {
    try {
      await apiClient.removeWhitelistAddress(addressId);
      setWhitelistAddresses((prev) => prev.filter((a) => a.id !== addressId));
    } catch (error) {
      console.error("Failed to remove address:", error);
    }
  };

  const handleNewAddressChange = (field: string, value: string) => {
    setNewAddress((prev) => ({ ...prev, [field]: value }));
  };

  return {
    whitelistEnabled,
    whitelistAddresses,
    isLoadingWhitelist,
    showAddAddress,
    newAddress,
    isAddingAddress,
    whitelistMessage,
    setShowAddAddress,
    handleToggleWhitelist,
    handleAddAddress,
    handleRemoveAddress,
    handleNewAddressChange,
  };
}
