"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    setIsProfileMenuOpen(false);
  };

  return (
    <header className="bg-black">
      <div className="container mx-auto px-6">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-3">
              <Image
                src="/logo-color-light.svg"
                alt="dotmx logo"
                width={120}
                height={30}
                priority
                unoptimized
                className="h-8 w-auto"
              />
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden items-center space-x-8 lg:flex">
            <Link
              href="/trade"
              className="font-medium text-[#A3B8D9] transition-colors hover:text-[#3A8DFF]"
            >
              Perpetual Futures
            </Link>
            <div className="group relative">
              <span className="cursor-not-allowed font-medium text-[#A3B8D9] opacity-50">
                Spot Trading
              </span>
              <span className="absolute top-8 left-1/2 -translate-x-1/2 transform rounded bg-black px-2 py-1 text-xs whitespace-nowrap text-[#3A8DFF] opacity-0 transition-opacity group-hover:opacity-100">
                Coming Soon
              </span>
            </div>
            <Link
              href="/docs"
              className="font-medium text-[#A3B8D9] transition-colors hover:text-[#3A8DFF]"
            >
              API Docs
            </Link>
            <Link
              href="/about"
              className="font-medium text-[#A3B8D9] transition-colors hover:text-[#3A8DFF]"
            >
              About
            </Link>
          </nav>

          {/* Desktop CTA */}
          <div className="hidden items-center space-x-4 lg:flex">
            {isLoading ? (
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#3A8DFF] border-t-transparent" />
            ) : isAuthenticated && user ? (
              <div className="relative" ref={profileMenuRef}>
                <button
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="flex items-center space-x-2 rounded-lg border border-[#23345C] bg-[#122347] px-3 py-2 transition-colors hover:border-[#3A8DFF]"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3A8DFF] text-sm font-bold text-white">
                    {user.first_name?.[0] ||
                      user.email?.[0]?.toUpperCase() ||
                      "U"}
                  </div>
                  <span className="text-sm font-medium text-white">
                    {user.first_name || user.email?.split("@")[0] || "User"}
                  </span>
                  <svg
                    className={`h-4 w-4 text-[#A3B8D9] transition-transform ${isProfileMenuOpen ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {/* Profile Dropdown Menu */}
                {isProfileMenuOpen && (
                  <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-[#23345C] bg-[#122347] py-2 shadow-xl">
                    <div className="border-b border-[#23345C] px-4 py-3">
                      <p className="text-sm font-medium text-white">
                        {user.first_name && user.last_name
                          ? `${user.first_name} ${user.last_name}`
                          : user.username || user.email}
                      </p>
                      <p className="text-xs text-[#A3B8D9]">{user.email}</p>
                    </div>
                    <Link
                      href="/portal/portfolio"
                      className="flex items-center space-x-2 px-4 py-2 text-sm text-[#A3B8D9] transition-colors hover:bg-[#0A0E1A] hover:text-white"
                      onClick={() => setIsProfileMenuOpen(false)}
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                        />
                      </svg>
                      <span>Portfolio</span>
                    </Link>
                    <Link
                      href="/portal/profile"
                      className="flex items-center space-x-2 px-4 py-2 text-sm text-[#A3B8D9] transition-colors hover:bg-[#0A0E1A] hover:text-white"
                      onClick={() => setIsProfileMenuOpen(false)}
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                      <span>Profile</span>
                    </Link>
                    <Link
                      href="/portal/security"
                      className="flex items-center space-x-2 px-4 py-2 text-sm text-[#A3B8D9] transition-colors hover:bg-[#0A0E1A] hover:text-white"
                      onClick={() => setIsProfileMenuOpen(false)}
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      <span>Settings</span>
                    </Link>
                    <div className="my-2 border-t border-[#23345C]" />
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center space-x-2 px-4 py-2 text-sm text-red-400 transition-colors hover:bg-[#0A0E1A]"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                        />
                      </svg>
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link
                  href="/login"
                  className="font-medium text-[#A3B8D9] transition-colors hover:text-[#3A8DFF]"
                >
                  Sign In
                </Link>
                <Link
                  href="/trade"
                  className="rounded-lg bg-linear-to-r from-[#3A8DFF] to-[#5865F2] px-6 py-2.5 font-semibold text-white transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/50"
                >
                  Launch App
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 lg:hidden"
            aria-label="Toggle mobile menu"
          >
            <div className="flex h-6 w-6 flex-col items-center justify-center">
              <span
                className={`block h-0.5 w-6 transform bg-[#A3B8D9] transition-all duration-300 ${
                  isMobileMenuOpen ? "translate-y-1.5 rotate-45" : ""
                }`}
              ></span>
              <span
                className={`my-1 block h-0.5 w-6 bg-[#A3B8D9] transition-all duration-300 ${
                  isMobileMenuOpen ? "opacity-0" : ""
                }`}
              ></span>
              <span
                className={`block h-0.5 w-6 transform bg-[#A3B8D9] transition-all duration-300 ${
                  isMobileMenuOpen ? "-translate-y-1.5 -rotate-45" : ""
                }`}
              ></span>
            </div>
          </button>
        </div>

        {/* Mobile Navigation */}
        <div
          className={`overflow-hidden transition-all duration-300 lg:hidden ${
            isMobileMenuOpen ? "max-h-[500px] pb-6" : "max-h-0"
          }`}
        >
          <div className="border-t border-[#23345C] pt-6">
            <nav className="flex flex-col space-y-4">
              <Link
                href="/trade"
                className="font-medium text-[#A3B8D9] transition-colors hover:text-[#3A8DFF]"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Perpetual Futures
              </Link>
              <div className="font-medium text-[#A3B8D9] opacity-50">
                Spot Trading{" "}
                <span className="ml-2 text-xs text-[#3A8DFF]">Coming Soon</span>
              </div>
              <Link
                href="/docs"
                className="font-medium text-[#A3B8D9] transition-colors hover:text-[#3A8DFF]"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                API Docs
              </Link>
              <Link
                href="/about"
                className="font-medium text-[#A3B8D9] transition-colors hover:text-[#3A8DFF]"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                About
              </Link>

              {/* Mobile Auth Section */}
              <div className="border-t border-[#23345C] pt-4">
                {isLoading ? (
                  <div className="flex justify-center py-4">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#3A8DFF] border-t-transparent" />
                  </div>
                ) : isAuthenticated && user ? (
                  <>
                    <div className="mb-4 flex items-center space-x-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#3A8DFF] text-sm font-bold text-white">
                        {user.first_name?.[0] ||
                          user.email?.[0]?.toUpperCase() ||
                          "U"}
                      </div>
                      <div>
                        <p className="font-medium text-white">
                          {user.first_name && user.last_name
                            ? `${user.first_name} ${user.last_name}`
                            : user.username || user.email}
                        </p>
                        <p className="text-xs text-[#A3B8D9]">{user.email}</p>
                      </div>
                    </div>
                    <Link
                      href="/portal/portfolio"
                      className="block font-medium text-[#A3B8D9] transition-colors hover:text-[#3A8DFF]"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Portfolio
                    </Link>
                    <Link
                      href="/portal/profile"
                      className="mt-2 block font-medium text-[#A3B8D9] transition-colors hover:text-[#3A8DFF]"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Profile
                    </Link>
                    <Link
                      href="/portal/security"
                      className="mt-2 block font-medium text-[#A3B8D9] transition-colors hover:text-[#3A8DFF]"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Security
                    </Link>
                    <button
                      onClick={() => {
                        handleLogout();
                        setIsMobileMenuOpen(false);
                      }}
                      className="mt-4 block w-full rounded-lg border border-red-500 px-6 py-2.5 text-center font-semibold text-red-400 transition-all duration-200 hover:bg-red-500/10"
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="block font-medium text-[#A3B8D9] transition-colors hover:text-[#3A8DFF]"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Sign In
                    </Link>
                    <div className="mt-4">
                      <Link
                        href="/trade"
                        className="block rounded-lg bg-linear-to-r from-[#3A8DFF] to-[#5865F2] px-6 py-2.5 text-center font-semibold text-white transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/50"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        Launch App
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
