import { useState } from "react";
import { apiClient } from "@/services/ApiClient";
import { getPasswordStrength } from "../utils";

export function usePassword() {
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordVisibility, setPasswordVisibility] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [passwordForm, setPasswordForm] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const passwordStrength = getPasswordStrength(passwordForm.new);

  const handleChangePassword = async () => {
    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordMessage({ type: "error", text: "Passwords do not match" });
      return;
    }
    if (passwordForm.new.length < 8) {
      setPasswordMessage({
        type: "error",
        text: "Password must be at least 8 characters",
      });
      return;
    }
    setIsChangingPassword(true);
    setPasswordMessage(null);
    try {
      await apiClient.changePassword({
        old_password: passwordForm.current,
        new_password: passwordForm.new,
      });
      setPasswordMessage({
        type: "success",
        text: "Password changed successfully",
      });
      setPasswordForm({ current: "", new: "", confirm: "" });
      setTimeout(() => setShowChangePassword(false), 1500);
    } catch (error) {
      console.error("Password change failed:", error);
      setPasswordMessage({
        type: "error",
        text: "Failed to change password. Check your current password.",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handlePasswordFormChange = (field: string, value: string) => {
    setPasswordForm((prev) => ({ ...prev, [field]: value }));
  };

  const handlePasswordVisibilityToggle = (field: string) => {
    setPasswordVisibility((prev) => ({
      ...prev,
      [field]: !prev[field as keyof typeof prev],
    }));
  };

  return {
    showChangePassword,
    setShowChangePassword,
    passwordForm,
    passwordVisibility,
    passwordStrength,
    isChangingPassword,
    passwordMessage,
    handleChangePassword,
    handlePasswordFormChange,
    handlePasswordVisibilityToggle,
  };
}
