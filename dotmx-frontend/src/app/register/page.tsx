"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import type { RegisterRequest } from "@/services/ApiClient";
import { Button } from "@/components/ui";

export default function RegisterPage() {
  const router = useRouter();
  const { register, isLoading, isAuthenticated } = useAuth();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    first_name: "",
    last_name: "",
    username: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({
    hasMinLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecial: false,
  });

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push("/portal/portfolio");
    }
  }, [isAuthenticated, router]);

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

    if (name === "password") {
      validatePassword(value);
    }
  };

  const isPasswordValid = Object.values(passwordStrength).every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!isPasswordValid) {
      setError("Password does not meet requirements");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: RegisterRequest = {
        email: formData.email,
        password: formData.password,
      };

      if (formData.first_name) payload.first_name = formData.first_name;
      if (formData.last_name) payload.last_name = formData.last_name;
      if (formData.username) payload.username = formData.username;

      await register(payload);
      router.push("/portal/portfolio");
    } catch (err) {
      console.error("Registration error:", err);
      let errorMessage = "Registration failed. Please try again.";

      if (err instanceof Error) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-10 flex justify-center">
          <Link href="/">
            <Image
              src="/logo-color-light.svg"
              alt="dotmx logo"
              width={150}
              height={40}
              priority
              unoptimized
              className="h-10 w-auto transition-opacity hover:opacity-80"
            />
          </Link>
        </div>

        {/* Register Card */}
        <div className="border-border bg-background-card rounded-xl border p-8">
          <h1 className="text-foreground mb-2 text-center text-2xl font-bold">
            Create Account
          </h1>
          <p className="text-foreground-muted mb-8 text-center text-sm">
            Sign up to start trading
          </p>

          {error && (
            <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-center text-sm text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor="first_name"
                  className="text-foreground-muted mb-2 block text-sm font-medium"
                >
                  First Name
                </label>
                <input
                  type="text"
                  id="first_name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  className="border-border bg-background text-foreground placeholder-foreground-muted focus:border-accent w-full rounded-lg border px-4 py-2.5 transition-colors focus:outline-none"
                  placeholder="John"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label
                  htmlFor="last_name"
                  className="text-foreground-muted mb-2 block text-sm font-medium"
                >
                  Last Name
                </label>
                <input
                  type="text"
                  id="last_name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  className="border-border bg-background text-foreground placeholder-foreground-muted focus:border-accent w-full rounded-lg border px-4 py-2.5 transition-colors focus:outline-none"
                  placeholder="Doe"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="username"
                className="text-foreground-muted mb-2 block text-sm font-medium"
              >
                Username (Optional)
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                className="border-border bg-background text-foreground placeholder-foreground-muted focus:border-accent w-full rounded-lg border px-4 py-2.5 transition-colors focus:outline-none"
                placeholder="johndoe"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="text-foreground-muted mb-2 block text-sm font-medium"
              >
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="border-border bg-background text-foreground placeholder-foreground-muted focus:border-accent w-full rounded-lg border px-4 py-2.5 transition-colors focus:outline-none"
                placeholder="Enter your email"
                required
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="text-foreground-muted mb-2 block text-sm font-medium"
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="border-border bg-background text-foreground placeholder-foreground-muted focus:border-accent w-full rounded-lg border px-4 py-2.5 transition-colors focus:outline-none"
                placeholder="Enter your password"
                required
                disabled={isSubmitting}
              />

              {formData.password && (
                <div className="mt-2 space-y-1 text-xs">
                  <div
                    className={
                      passwordStrength.hasMinLength
                        ? "text-green-400"
                        : "text-foreground-muted"
                    }
                  >
                    ✓ At least 8 characters
                  </div>
                  <div
                    className={
                      passwordStrength.hasUppercase
                        ? "text-green-400"
                        : "text-foreground-muted"
                    }
                  >
                    ✓ One uppercase letter
                  </div>
                  <div
                    className={
                      passwordStrength.hasLowercase
                        ? "text-green-400"
                        : "text-foreground-muted"
                    }
                  >
                    ✓ One lowercase letter
                  </div>
                  <div
                    className={
                      passwordStrength.hasNumber
                        ? "text-green-400"
                        : "text-foreground-muted"
                    }
                  >
                    ✓ One number
                  </div>
                  <div
                    className={
                      passwordStrength.hasSpecial
                        ? "text-green-400"
                        : "text-foreground-muted"
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
                className="text-foreground-muted mb-2 block text-sm font-medium"
              >
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="border-border bg-background text-foreground placeholder-foreground-muted focus:border-accent w-full rounded-lg border px-4 py-2.5 transition-colors focus:outline-none"
                placeholder="Confirm your password"
                required
                disabled={isSubmitting}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={isSubmitting || isLoading}
              disabled={isSubmitting || isLoading}
            >
              {isSubmitting ? "Creating account..." : "Create Account"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-foreground-muted text-sm">
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-accent hover:text-accent/80 font-medium transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-foreground-muted text-xs">
            By signing up, you agree to our{" "}
            <Link
              href="/terms"
              className="text-foreground hover:text-accent transition-colors"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="text-foreground hover:text-accent transition-colors"
            >
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
