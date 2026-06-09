/**
 * Device information utilities for session tracking
 */

export interface DeviceInfo {
  device_name: string;
  device_fingerprint: string;
}

/**
 * Get browser name from user agent
 */
function getBrowserName(): string {
  if (typeof window === "undefined") return "Unknown";

  const ua = navigator.userAgent;

  if (ua.includes("Edg")) return "Edge";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari")) return "Safari";
  if (ua.includes("Opera") || ua.includes("OPR")) return "Opera";

  return "Unknown Browser";
}

/**
 * Get OS name from user agent
 */
function getOSName(): string {
  if (typeof window === "undefined") return "Unknown";

  const ua = navigator.userAgent;

  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Mac")) return "macOS";
  if (ua.includes("Linux") && !ua.includes("Android")) return "Linux";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";

  return "Unknown OS";
}

/**
 * Generate a simple device fingerprint based on available browser info
 * This is not a cryptographically secure fingerprint, but useful for identifying devices
 */
function generateFingerprint(): string {
  if (typeof window === "undefined") return "";

  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || "",
    navigator.platform || "",
  ];

  // Simple hash function
  const str = components.join("|");
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return Math.abs(hash).toString(16);
}

/**
 * Get device information for session tracking
 */
export function getDeviceInfo(): DeviceInfo {
  const browser = getBrowserName();
  const os = getOSName();
  const device_name = `${browser} on ${os}`;
  const device_fingerprint = generateFingerprint();

  return {
    device_name,
    device_fingerprint,
  };
}
