"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import { useUIAnalytics, usePerformanceAnalytics } from "@/hooks/useAnalytics";

/**
 * Optimized component that automatically tracks page views and performance
 * Features: automatic cleanup, performance tracking, memory optimization
 */
export const AnalyticsPageTracker = () => {
  const pathname = usePathname();
  const { trackPageView } = useUIAnalytics();
  const { trackPageLoad } = usePerformanceAnalytics();

  // Use refs to prevent unnecessary re-renders
  const pageLoadStartTime = useRef<number>(performance.now());
  const lastPathname = useRef<string>("");

  useEffect(() => {
    // Only track if pathname actually changed
    if (pathname && pathname !== lastPathname.current) {
      // Track page view with additional context
      const pageData = {
        referrer:
          typeof document !== "undefined"
            ? document.referrer || "direct"
            : "direct",
        timestamp: Date.now(),
        user_agent:
          typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      };

      trackPageView(pathname, pageData);
      lastPathname.current = pathname;

      // Reset page load timer for new page
      pageLoadStartTime.current = performance.now();
    }
  }, [pathname, trackPageView]);

  // Track page load performance
  useEffect(() => {
    const handleLoad = () => {
      const loadTime = performance.now() - pageLoadStartTime.current;
      if (pathname) {
        trackPageLoad(pathname, loadTime);
      }
    };

    // If page is already loaded
    if (typeof document !== "undefined" && document.readyState === "complete") {
      handleLoad();
    } else if (typeof window !== "undefined") {
      window.addEventListener("load", handleLoad);
      return () => window.removeEventListener("load", handleLoad);
    }

    return undefined;
  }, [pathname, trackPageLoad]);

  return null;
};

/**
 * Enhanced HOC for page-level analytics with performance optimizations
 */
export function withAnalytics<T extends Record<string, unknown>>(
  Component: React.ComponentType<T>,
  options?: {
    pageName?: string;
    trackPerformance?: boolean;
    additionalData?: Record<string, string | number | boolean>;
  }
) {
  const WrappedComponent = (props: T) => {
    const pathname = usePathname();
    const { trackPageView } = useUIAnalytics();
    const { trackPageLoad } = usePerformanceAnalytics();

    const pageLoadStart = useRef(performance.now());

    // Memoize tracking name to prevent recalculation
    const trackingName = useMemo(
      () => options?.pageName || pathname || "unknown",
      [pathname]
    );

    useEffect(() => {
      // Track page view with additional data
      trackPageView(trackingName, options?.additionalData);

      // Track performance if enabled
      if (options?.trackPerformance !== false) {
        const handleLoad = () => {
          const loadTime = performance.now() - pageLoadStart.current;
          trackPageLoad(trackingName, loadTime);
        };

        if (
          typeof document !== "undefined" &&
          document.readyState === "complete"
        ) {
          handleLoad();
        } else if (typeof window !== "undefined") {
          window.addEventListener("load", handleLoad);
          return () => window.removeEventListener("load", handleLoad);
        }
      }

      return undefined;
    }, [trackingName, trackPageView, trackPageLoad]);

    return <Component {...props} />;
  };

  WrappedComponent.displayName = `withAnalytics(${
    Component.displayName || Component.name
  })`;

  return WrappedComponent;
}

/**
 * Enhanced performance tracker with Web Vitals support
 */
export const PerformanceTracker = ({
  pageName,
  trackWebVitals = true,
}: {
  pageName: string;
  trackWebVitals?: boolean;
}) => {
  const { trackPageLoad, trackApiCall } = usePerformanceAnalytics();
  const startTime = useRef(performance.now());

  useEffect(() => {
    // Track basic page load
    const handleLoad = () => {
      const loadTime = performance.now() - startTime.current;
      trackPageLoad(pageName, loadTime);
    };

    // Monitor long tasks if supported
    if (typeof window !== "undefined" && "PerformanceObserver" in window) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === "longtask") {
            trackApiCall(`longtask_${pageName}`, entry.duration, false);
          }
        });
      });

      try {
        observer.observe({ entryTypes: ["longtask"] });
      } catch {
        // Fallback for browsers that don't support longtask
      }

      return () => observer.disconnect();
    }

    // Fallback for basic load tracking
    const handleLoadTracking = () => {
      if (
        typeof document !== "undefined" &&
        document.readyState === "complete"
      ) {
        handleLoad();
      }
    };

    handleLoadTracking();
    return undefined;
  }, [pageName, trackPageLoad, trackApiCall, trackWebVitals]);

  return null;
};

/**
 * Analytics error boundary for tracking React errors
 */
interface AnalyticsErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error }>;
}

interface AnalyticsErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class AnalyticsErrorBoundary extends React.Component<
  AnalyticsErrorBoundaryProps,
  AnalyticsErrorBoundaryState
> {
  constructor(props: AnalyticsErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): AnalyticsErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Track error in analytics
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "react_error", {
        event_category: "error",
        event_label: error.message,
        custom_parameters: {
          error_message: error.message,
          error_stack: error.stack || "",
          component_stack: errorInfo.componentStack || "",
          timestamp: Date.now(),
        },
      });
    }
  }

  override render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback;
      if (FallbackComponent) {
        return <FallbackComponent error={this.state.error} />;
      }

      return (
        <div className="rounded border border-red-200 bg-red-50 p-4">
          <h2 className="font-semibold text-red-800">Something went wrong</h2>
          <details className="mt-2">
            <summary className="cursor-pointer text-red-600">
              Error details
            </summary>
            <pre className="mt-2 text-sm whitespace-pre-wrap text-red-700">
              {this.state.error.message}
            </pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}
