import { useMemo } from "react";
import { analytics } from "@/utils/analytics";

/**
 * Hook for UI interactions analytics
 */
export const useUIAnalytics = () => {
  return useMemo(
    () => ({
      trackPageView: (
        pageName: string,
        additionalData?: Record<string, string | number | boolean>
      ) => {
        analytics.ui.pageView(pageName, additionalData);
      },

      trackButtonClick: (
        buttonName: string,
        location: string,
        additionalData?: Record<string, string | number | boolean>
      ) => {
        analytics.ui.buttonClick(buttonName, location, additionalData);
      },

      trackModalOpen: (modalName: string) => {
        analytics.ui.modalOpen(modalName);
      },

      trackModalClose: (modalName: string) => {
        analytics.ui.modalClose(modalName);
      },
    }),
    []
  );
};

/**
 * Hook for wallet-related analytics events
 */
export const useWalletAnalytics = () => {
  return useMemo(
    () => ({
      trackWalletConnect: (walletType: string) => {
        analytics.wallet.connect(walletType);
      },

      trackWalletDisconnect: () => {
        analytics.wallet.disconnect();
      },

      trackDeposit: (amount: number, token: string) => {
        analytics.wallet.deposit(amount, token);
      },

      trackWithdraw: (amount: number, token: string) => {
        analytics.wallet.withdraw(amount, token);
      },
    }),
    []
  );
};

/**
 * Hook for major events and milestones
 */
export const useMajorEventAnalytics = () => {
  return useMemo(
    () => ({
      trackAccountFunded: (amount: number, token: string) => {
        analytics.major.accountFunded(amount, token);
      },
    }),
    []
  );
};

/**
 * Hook for performance tracking
 */
export const usePerformanceAnalytics = () => {
  return useMemo(
    () => ({
      trackPageLoad: (pageName: string, loadTime: number) => {
        analytics.performance.pageLoad(pageName, loadTime);
      },

      trackApiCall: (
        endpoint: string,
        responseTime: number,
        success: boolean
      ) => {
        analytics.performance.apiCall(endpoint, responseTime, success);
      },

      wrapApiCall: async <T>(
        endpoint: string,
        apiCall: () => Promise<T>
      ): Promise<T> => {
        const startTime = performance.now();
        try {
          const result = await apiCall();
          const endTime = performance.now();
          analytics.performance.apiCall(endpoint, endTime - startTime, true);
          return result;
        } catch (error) {
          const endTime = performance.now();
          analytics.performance.apiCall(endpoint, endTime - startTime, false);
          throw error;
        }
      },
    }),
    []
  );
};
