"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { apiClient } from "@/services/ApiClient";
import { Button } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await apiClient.requestPasswordReset({ email });
      setIsSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to send reset email. Please try again."
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
              Check Your Email
            </h1>
            <p className="mb-6 text-[#A3B8D9]">
              We&apos;ve sent a password reset link to{" "}
              <strong className="text-white">{email}</strong>
            </p>
            <p className="mb-8 text-sm text-[#6B7A99]">
              Please check your email and click the link to reset your password.
              The link will expire in 1 hour.
            </p>

            <Link href="/login">
              <Button variant="primary" fullWidth>
                Back to Sign In
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
            Reset Password
          </h1>
          <p className="mb-8 text-center text-[#A3B8D9]">
            Enter your email address and we&apos;ll send you a link to reset
            your password
          </p>

          {error && (
            <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-center text-sm text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-[#A3B8D9]"
              >
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-[#23345C] bg-[#0A0E1A] px-4 py-3 text-white placeholder-[#6B7A99] transition-colors focus:border-[#3A8DFF] focus:ring-1 focus:ring-[#3A8DFF] focus:outline-none"
                placeholder="Enter your email"
                required
                disabled={isSubmitting}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Sending..." : "Send Reset Link"}
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
