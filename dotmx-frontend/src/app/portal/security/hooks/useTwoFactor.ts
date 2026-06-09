import { useState, useEffect } from "react";
import {
  apiClient,
  type TwoFactorStatus,
  type TwoFactorSetupResponse,
} from "@/services/ApiClient";

export function useTwoFactor(isAuthenticated: boolean) {
  const [twoFactorStatus, setTwoFactorStatus] =
    useState<TwoFactorStatus | null>(null);
  const [isLoading2FA, setIsLoading2FA] = useState(true);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [setupData, setSetupData] = useState<TwoFactorSetupResponse | null>(
    null
  );
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerifying2FA, setIsVerifying2FA] = useState(false);
  const [show2FADisable, setShow2FADisable] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [isDisabling2FA, setIsDisabling2FA] = useState(false);
  const [twoFAMessage, setTwoFAMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Load 2FA status
  useEffect(() => {
    if (!isAuthenticated) return;
    const load2FAStatus = async () => {
      try {
        const status = await apiClient.get2FAStatus();
        setTwoFactorStatus(status);
      } catch (error) {
        console.error("Failed to load 2FA status:", error);
      } finally {
        setIsLoading2FA(false);
      }
    };
    load2FAStatus();
  }, [isAuthenticated]);

  const handleStart2FASetup = async () => {
    setTwoFAMessage(null);
    try {
      const data = await apiClient.setup2FA();
      setSetupData(data);
      setShow2FASetup(true);
    } catch (error) {
      console.error("Failed to start 2FA setup:", error);
      setTwoFAMessage({ type: "error", text: "Failed to start 2FA setup" });
    }
  };

  const handleVerify2FA = async () => {
    if (verificationCode.length !== 6) {
      setTwoFAMessage({ type: "error", text: "Enter a 6-digit code" });
      return;
    }
    setIsVerifying2FA(true);
    setTwoFAMessage(null);
    try {
      await apiClient.verify2FA(verificationCode);
      setTwoFactorStatus({
        enabled: true,
        method: "totp",
        setup_completed: true,
      });
      setShow2FASetup(false);
      setShowBackupCodes(true);
      setVerificationCode("");
      setTwoFAMessage({ type: "success", text: "2FA enabled successfully!" });
    } catch (error) {
      console.error("2FA verification failed:", error);
      setTwoFAMessage({ type: "error", text: "Invalid verification code" });
    } finally {
      setIsVerifying2FA(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!disablePassword) {
      setTwoFAMessage({ type: "error", text: "Enter your password" });
      return;
    }
    setIsDisabling2FA(true);
    setTwoFAMessage(null);
    try {
      await apiClient.disable2FA(disablePassword);
      setTwoFactorStatus({
        enabled: false,
        method: null,
        setup_completed: false,
      });
      setShow2FADisable(false);
      setDisablePassword("");
      setTwoFAMessage({ type: "success", text: "2FA disabled" });
    } catch (error) {
      console.error("Failed to disable 2FA:", error);
      setTwoFAMessage({ type: "error", text: "Invalid password" });
    } finally {
      setIsDisabling2FA(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return {
    twoFactorStatus,
    isLoading2FA,
    show2FASetup,
    setupData,
    verificationCode,
    isVerifying2FA,
    show2FADisable,
    disablePassword,
    isDisabling2FA,
    twoFAMessage,
    showBackupCodes,
    copiedCode,
    setShow2FASetup,
    setShow2FADisable,
    setShowBackupCodes,
    setVerificationCode,
    setDisablePassword,
    handleStart2FASetup,
    handleVerify2FA,
    handleDisable2FA,
    copyToClipboard,
  };
}
