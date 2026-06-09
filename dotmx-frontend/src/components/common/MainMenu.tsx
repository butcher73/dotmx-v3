"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";

interface MainMenuProps {
  className?: string;
}

export default function MainMenu({ className = "" }: MainMenuProps) {
  const [showMainMenu, setShowMainMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMainMenu(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className={`relative flex items-center ${className}`} ref={menuRef}>
      <button
        onClick={() => setShowMainMenu(!showMainMenu)}
        className="flex items-center rounded-lg p-1.5 text-white transition-colors hover:bg-white/5 hover:text-[#4F90FF]"
      >
        <Image
          src="/menu.svg"
          alt="Menu"
          width={18}
          height={18}
          unoptimized
          className="h-4 w-4"
        />
      </button>

      {/* Main Menu Dropdown */}
      {showMainMenu && (
        <div className="absolute top-full left-0 z-50 mt-1 min-w-[160px] overflow-hidden rounded-lg border border-[#2a2d47] bg-[#1e2139] shadow-xl">
          <div className="py-1">
            <a
              href="/trade/perp"
              className="flex items-center px-3 py-2 text-sm text-[#a3b8d9] transition-colors hover:bg-[#262a44] hover:text-white"
            >
              Perpetuals
            </a>
            <a
              href="/portal/lp"
              className="flex items-center px-3 py-2 text-sm text-[#a3b8d9] transition-colors hover:bg-[#262a44] hover:text-white"
            >
              Liquidity
            </a>
            <a
              href="/portal/portfolio"
              className="flex items-center px-3 py-2 text-sm text-[#a3b8d9] transition-colors hover:bg-[#262a44] hover:text-white"
            >
              Portfolio
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
