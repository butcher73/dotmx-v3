/**
 * Settings API Service
 */

import { api } from '@/libs/api';

export interface Setting {
  key: string;
  value: unknown;
  category: string;
  description: string;
  updatedAt: string;
  updatedBy: string | null;
}

export const settingsService = {
  /**
   * Get all settings, optionally filtered by category
   */
  getSettings: (category?: string) =>
    api.get<Setting[]>('/settings', category ? { category } : undefined),
  
  /**
   * Get available setting categories
   */
  getCategories: () =>
    api.get<string[]>('/settings/categories'),
  
  /**
   * Get a specific setting by key
   */
  getSetting: (key: string) =>
    api.get<Setting>(`/settings/${key}`),
  
  /**
   * Update a setting
   */
  updateSetting: (key: string, value: unknown, category?: string, description?: string) =>
    api.put<{ success: boolean }>(`/settings/${key}`, { value, category, description }),
  
  /**
   * Delete a setting
   */
  deleteSetting: (key: string) =>
    api.delete<{ success: boolean }>(`/settings/${key}`)
};
