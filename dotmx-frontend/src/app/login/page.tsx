"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push("/portal/portfolio");
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login({ email, password });
      router.push("/portal/portfolio");
    } catch (err) {
      let errorMessage = "Login failed. Please try again.";

      if (err instanceof Error) {
        const authError = err as Error & { statusCode?: number };
        if (authError.statusCode === 401) {
          errorMessage = "Invalid email or password. Please try again.";
        } else {
          console.error("Login error:", err);
          errorMessage = err.message;
        }
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

        {/* Login Card */}
        <div className="border-border bg-background-card rounded-xl border p-8">
          <h1 className="text-foreground mb-2 text-center text-2xl font-bold">
            Welcome Back
          </h1>
          <p className="text-foreground-muted mb-8 text-center text-sm">
            Sign in to your account
          </p>

          {error && (
            <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-center text-sm text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border-border bg-background text-foreground placeholder-foreground-muted focus:border-accent w-full rounded-lg border px-4 py-2.5 transition-colors focus:outline-none"
                placeholder="Enter your password"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="border-border bg-background text-accent focus:ring-accent h-4 w-4 rounded focus:ring-offset-0"
                />
                <span className="text-foreground-muted ml-2">Remember me</span>
              </label>
              <Link
                href="/forgot-password"
                className="text-accent hover:text-accent/80 transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={isSubmitting || isLoading}
              disabled={isSubmitting || isLoading}
            >
              {isSubmitting ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-foreground-muted text-sm">
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="text-accent hover:text-accent/80 font-medium transition-colors"
              >
                Sign up
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-foreground-muted text-xs">
            By signing in, you agree to our{" "}
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
