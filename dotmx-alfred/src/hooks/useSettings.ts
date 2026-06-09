'use client';

import { useState, useEffect, useCallback } from 'react';
import { settingsService, type Setting } from '@/services/settings';

export function useSettings(category?: string) {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await settingsService.getSettings(category);
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch settings');
    } finally {
      setIsLoading(false);
    }
  }, [category]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSetting = async (key: string, value: unknown) => {
    try {
      await settingsService.updateSetting(key, value);
      await fetchSettings();
    } catch (err) {
      throw err;
    }
  };

  const deleteSetting = async (key: string) => {
    try {
      await settingsService.deleteSetting(key);
      await fetchSettings();
    } catch (err) {
      throw err;
    }
  };

  return { settings, isLoading, error, refetch: fetchSettings, updateSetting, deleteSetting };
}

export function useSettingCategories() {
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await settingsService.getCategories();
        setCategories(data);
      } catch (err) {
        console.error('Failed to fetch setting categories:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategories();
  }, []);

  return { categories, isLoading };
}

export function useSetting(key: string) {
  const [setting, setSetting] = useState<Setting | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSetting = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await settingsService.getSetting(key);
      setSetting(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch setting');
    } finally {
      setIsLoading(false);
    }
  }, [key]);

  useEffect(() => {
    fetchSetting();
  }, [fetchSetting]);

  const updateValue = async (value: unknown) => {
    try {
      await settingsService.updateSetting(key, value);
      await fetchSetting();
    } catch (err) {
      throw err;
    }
  };

  return { setting, isLoading, error, refetch: fetchSetting, updateValue };
}
