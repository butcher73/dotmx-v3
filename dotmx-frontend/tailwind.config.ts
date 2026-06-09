import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // DotMX Design System
        // Background colors
        background: {
          DEFAULT: "#000000",
          card: "#050505",
          elevated: "#0a0a0a",
          hover: "#0f0f0f",
        },
        // Border colors (very dark, 1px thin)
        border: {
          DEFAULT: "#0a0a0a",
          muted: "#080808",
          accent: "#0d0d0d",
          hover: "#111111",
        },
        // Text colors (high contrast for readability)
        foreground: {
          DEFAULT: "#ffffff",
          muted: "#9ca3af",
          subtle: "#6b7280",
          disabled: "#4b5563",
        },
        // Brand accent
        accent: {
          DEFAULT: "#3A8DFF",
          hover: "#5BA3FF",
          muted: "#3A8DFF26", // 15% opacity
          subtle: "#3A8DFF12", // 7% opacity
        },
        // Semantic colors
        positive: {
          DEFAULT: "#00D897",
          muted: "#00D89726", // 15% opacity
          subtle: "#00D89712",
        },
        negative: {
          DEFAULT: "#FF6B6B",
          muted: "#FF6B6B26", // 15% opacity
          subtle: "#FF6B6B12",
        },
        warning: {
          DEFAULT: "#F59E0B",
          muted: "#F59E0B26", // 15% opacity
          subtle: "#F59E0B12",
        },
        info: {
          DEFAULT: "#A855F7",
          muted: "#A855F726", // 15% opacity
          subtle: "#A855F712",
        },
        // Legacy colors (for gradual migration)
        primary: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          200: "#bae6fd",
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
          800: "#075985",
          900: "#0c4a6e",
        },
        success: {
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
        },
        danger: {
          50: "#fef2f2",
          100: "#fee2e2",
          200: "#fecaca",
          300: "#fca5a5",
          400: "#f87171",
          500: "#ef4444",
          600: "#dc2626",
          700: "#b91c1c",
          800: "#991b1b",
          900: "#7f1d1d",
        },
        neutral: {
          50: "#fafafa",
          100: "#f5f5f5",
          200: "#e5e5e5",
          300: "#d4d4d4",
          400: "#a3a3a3",
          500: "#737373",
          600: "#525252",
          700: "#404040",
          800: "#262626",
          900: "#171717",
          950: "#0a0a0a",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.75rem" }],
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-in-out",
        "slide-up": "slideUp 0.3s ease-out",
        "slide-down": "slideDown 0.3s ease-out",
        "scale-in": "scaleIn 0.2s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        slideDown: {
          "0%": { transform: "translateY(-10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        scaleIn: {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      spacing: {
        "18": "4.5rem",
        "88": "22rem",
        "128": "32rem",
      },
      borderRadius: {
        none: "0",
        sm: "0.125rem",
        DEFAULT: "0.25rem",
        md: "0.375rem",
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1rem",
        "3xl": "1.5rem",
        full: "9999px",
      },
      backdropBlur: {
        xs: "2px",
      },
      boxShadow: {
        "inner-lg": "inset 0 2px 4px 0 rgb(0 0 0 / 0.05)",
        glow: "0 0 20px rgb(59 130 246 / 0.5)",
        "glow-green": "0 0 20px rgb(34 197 94 / 0.5)",
        "glow-red": "0 0 20px rgb(239 68 68 / 0.5)",
      },
    },
  },
  plugins: [],
};

export default config;
