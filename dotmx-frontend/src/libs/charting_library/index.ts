/**
 * TradingView Charting Library Exports
 * 
 * The TradingView library is loaded as a global object in the browser.
 * This file provides type-safe access to the global TradingView.widget constructor.
 * 
 * The actual library files are served from /public/charting_library/
 */

// Import types only (not runtime code)
import type { ChartingLibraryWidgetConstructor } from "./charting_library/charting_library.d";

// Declare the global TradingView object that's loaded via script tag
declare global {
  interface Window {
    TradingView?: {
      widget: ChartingLibraryWidgetConstructor;
      version?: () => string;
    };
  }
}

// Export the widget constructor from the global namespace
// This will be available after the charting library loads in the browser
export const widget: ChartingLibraryWidgetConstructor = (function() {
  if (typeof window !== 'undefined' && window.TradingView) {
    return window.TradingView.widget;
  }
  // Return a dummy constructor for SSR/build time
  // The real widget will be loaded dynamically in the browser
  return null as any; // eslint-disable-line @typescript-eslint/no-explicit-any
})();

// Re-export types for convenience
export type * from "./charting_library/charting_library.d";

