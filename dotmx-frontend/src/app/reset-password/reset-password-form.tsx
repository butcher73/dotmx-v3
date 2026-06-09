"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { apiClient } from "@/services/ApiClient";
import { Button } from "@/components/ui";

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordStrength, setPasswordStrength] = useState({
    hasMinLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecial: false,
  });

  useEffect(() => {
    const tokenParam = searchParams.get("token");
    if (!tokenParam) {
      setError("Invalid or missing reset token");
    } else {
      setToken(tokenParam);
    }
  }, [searchParams]);

  const validatePassword = (password: string) => {
    setPasswordStrength({
      hasMinLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    if (name === "newPassword") {
      validatePassword(value);
    }
  };

  const isPasswordValid = Object.values(passwordStrength).every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Invalid or missing reset token");
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!isPasswordValid) {
      setError("Password does not meet requirements");
      return;
    }

    setIsSubmitting(true);

    try {
      await apiClient.resetPassword({
        token,
        new_password: formData.newPassword,
      });
      setIsSuccess(true);

      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to reset password. The link may have expired."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0E1A] px-4">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center">
            <Link href="/">
              <Image
                src="/logo-color-light.svg"
                alt="dotmx logo"
                width={150}
                height={40}
                priority
                unoptimized
                className="h-10 w-auto"
              />
            </Link>
          </div>

          <div className="rounded-2xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-8 text-center shadow-2xl">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-green-500/30 bg-green-500/10">
              <svg
                className="h-8 w-8 text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>

            <h1 className="mb-2 text-2xl font-bold text-white">
              Password Reset Successful
            </h1>
            <p className="mb-6 text-[#A3B8D9]">
              Your password has been successfully reset. You can now sign in
              with your new password.
            </p>
            <p className="mb-8 text-sm text-[#6B7A99]">
              Redirecting to sign in page...
            </p>

            <Link href="/login">
              <Button variant="primary" fullWidth>
                Go to Sign In
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0E1A] px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Link href="/">
            <Image
              src="/logo-color-light.svg"
              alt="dotmx logo"
              width={150}
              height={40}
              priority
              unoptimized
              className="h-10 w-auto"
            />
          </Link>
        </div>

        <div className="rounded-2xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-8 shadow-2xl">
          <h1 className="mb-2 text-center text-2xl font-bold text-white">
            Create New Password
          </h1>
          <p className="mb-8 text-center text-[#A3B8D9]">
            Please enter your new password
          </p>

          {error && (
            <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-center text-sm text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="newPassword"
                className="mb-2 block text-sm font-medium text-[#A3B8D9]"
              >
                New Password
              </label>
              <input
                type="password"
                id="newPassword"
                name="newPassword"
                value={formData.newPassword}
                onChange={handleChange}
                className="w-full rounded-lg border border-[#23345C] bg-[#0A0E1A] px-4 py-3 text-white placeholder-[#6B7A99] transition-colors focus:border-[#3A8DFF] focus:ring-1 focus:ring-[#3A8DFF] focus:outline-none"
                placeholder="Enter new password"
                required
                disabled={isSubmitting || !token}
              />

              {formData.newPassword && (
                <div className="mt-2 space-y-1 text-xs">
                  <div
                    className={
                      passwordStrength.hasMinLength
                        ? "text-green-400"
                        : "text-[#6B7A99]"
                    }
                  >
                    ✓ At least 8 characters
                  </div>
                  <div
                    className={
                      passwordStrength.hasUppercase
                        ? "text-green-400"
                        : "text-[#6B7A99]"
                    }
                  >
                    ✓ One uppercase letter
                  </div>
                  <div
                    className={
                      passwordStrength.hasLowercase
                        ? "text-green-400"
                        : "text-[#6B7A99]"
                    }
                  >
                    ✓ One lowercase letter
                  </div>
                  <div
                    className={
                      passwordStrength.hasNumber
                        ? "text-green-400"
                        : "text-[#6B7A99]"
                    }
                  >
                    ✓ One number
                  </div>
                  <div
                    className={
                      passwordStrength.hasSpecial
                        ? "text-green-400"
                        : "text-[#6B7A99]"
                    }
                  >
                    ✓ One special character
                  </div>
                </div>
              )}
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-2 block text-sm font-medium text-[#A3B8D9]"
              >
                Confirm New Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full rounded-lg border border-[#23345C] bg-[#0A0E1A] px-4 py-3 text-white placeholder-[#6B7A99] transition-colors focus:border-[#3A8DFF] focus:ring-1 focus:ring-[#3A8DFF] focus:outline-none"
                placeholder="Confirm new password"
                required
                disabled={isSubmitting || !token}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={isSubmitting}
              disabled={isSubmitting || !token}
            >
              {isSubmitting ? "Resetting..." : "Reset Password"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/login" className="text-[#A3B8D9] hover:text-[#3A8DFF]">
              ← Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
