import { Laptop, Tablet, Phone } from "lucide-react";

export const getDeviceInfo = (userAgent: string | undefined) => {
  if (!userAgent)
    return { type: "unknown", browser: "Unknown", os: "Unknown", icon: Laptop };

  const isMobile = /mobile|android|iphone/i.test(userAgent);
  const isTablet = /tablet|ipad/i.test(userAgent);

  const browser = userAgent.match(/edg/i)
    ? "Edge"
    : userAgent.match(/chrome/i)
      ? "Chrome"
      : userAgent.match(/firefox/i)
        ? "Firefox"
        : userAgent.match(/safari/i)
          ? "Safari"
          : "Unknown";

  const os = userAgent.match(/windows/i)
    ? "Windows"
    : userAgent.match(/mac/i)
      ? "macOS"
      : userAgent.match(/linux/i)
        ? "Linux"
        : userAgent.match(/android/i)
          ? "Android"
          : userAgent.match(/ios|iphone|ipad/i)
            ? "iOS"
            : "Unknown";

  return {
    type: isMobile ? "mobile" : isTablet ? "tablet" : "desktop",
    browser,
    os,
    icon: isMobile ? Phone : isTablet ? Tablet : Laptop,
  };
};

export const getPasswordStrength = (password: string) => {
  if (password.length === 0)
    return { strength: 0, label: "", color: "zinc", requirements: [] };

  const requirements = [
    { met: password.length >= 8, text: "At least 8 characters" },
    { met: password.length >= 12, text: "12+ characters (recommended)" },
    {
      met: /[a-z]/.test(password) && /[A-Z]/.test(password),
      text: "Mixed case letters",
    },
    { met: /[0-9]/.test(password), text: "Contains numbers" },
    { met: /[^a-zA-Z0-9]/.test(password), text: "Special characters" },
  ];

  if (password.length < 8)
    return { strength: 20, label: "Too Short", color: "red", requirements };

  let strength = 20;
  if (password.length >= 12) strength += 20;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 20;
  if (/[0-9]/.test(password)) strength += 20;
  if (/[^a-zA-Z0-9]/.test(password)) strength += 20;

  if (strength <= 40)
    return { strength: 40, label: "Weak", color: "red", requirements };
  if (strength <= 60)
    return { strength: 60, label: "Fair", color: "amber", requirements };
  if (strength <= 80)
    return { strength: 80, label: "Good", color: "emerald", requirements };
  return { strength: 100, label: "Excellent", color: "emerald", requirements };
};

export const calculateSecurityScore = (
  emailVerified: boolean | undefined,
  twoFactorEnabled: boolean | undefined,
  whitelistEnabled: boolean,
  hasActivity: boolean
) => {
  let score = 0;
  const factors = [];

  if (emailVerified) {
    score += 20;
    factors.push({ name: "Email Verified", points: 20, enabled: true });
  } else {
    factors.push({ name: "Email Verified", points: 20, enabled: false });
  }

  if (twoFactorEnabled) {
    score += 40;
    factors.push({ name: "Two-Factor Auth", points: 40, enabled: true });
  } else {
    factors.push({ name: "Two-Factor Auth", points: 40, enabled: false });
  }

  if (whitelistEnabled) {
    score += 25;
    factors.push({ name: "Withdrawal Whitelist", points: 25, enabled: true });
  } else {
    factors.push({ name: "Withdrawal Whitelist", points: 25, enabled: false });
  }

  if (hasActivity) {
    score += 15;
    factors.push({ name: "Active Account", points: 15, enabled: true });
  }

  return { score: Math.min(score, 100), factors };
};
