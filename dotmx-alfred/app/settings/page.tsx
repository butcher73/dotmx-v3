'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Save, Shield, DollarSign, Bell, Database, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { useSettings, useSettingCategories } from '@/hooks/useSettings';

// Default values for when settings don't exist yet
const defaultSettings = {
  // Trading
  'trading.makerFee': 0.08,
  'trading.takerFee': 0.10,
  'trading.minOrderSize': 10,
  'trading.maxOrderSize': 1000000,
  // Security
  'security.require2FA': true,
  'security.ipWhitelist': true,
  'security.sessionTimeout': 30,
  // Withdrawal
  'withdrawal.dailyLimit': 50000,
  'withdrawal.manualApprovalThreshold': 50000,
  'withdrawal.minWithdrawal': 20,
  'withdrawal.processingTime': 24,
  // Notifications
  'notifications.largeWithdrawalAlerts': true,
  'notifications.kycApplicationAlerts': true,
  'notifications.systemHealthAlerts': true,
};

export default function SettingsPage() {
  const { settings, isLoading, error, refetch, updateSetting } = useSettings();
  const { categories } = useSettingCategories();
  const [localSettings, setLocalSettings] = useState<Record<string, unknown>>(defaultSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Populate local settings from API data
  useEffect(() => {
    if (settings.length > 0) {
      const settingsMap: Record<string, unknown> = { ...defaultSettings };
      settings.forEach(setting => {
        settingsMap[setting.key] = setting.value;
      });
      setLocalSettings(settingsMap);
    }
  }, [settings]);

  // Get setting value with fallback
  const getSetting = <T,>(key: string, defaultValue: T): T => {
    const value = localSettings[key];
    return value !== undefined ? (value as T) : defaultValue;
  };

  // Handle local setting change
  const handleChange = (key: string, value: unknown) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
    setSaveSuccess(false);
  };

  // Save all settings
  const handleSaveAll = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      // Update each changed setting
      const updatePromises = Object.entries(localSettings).map(([key, value]) => {
        return updateSetting(key, value);
      });
      
      await Promise.all(updatePromises);
      setSaveSuccess(true);
      await refetch();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <div className="flex-1">
        <Header />
        
        <main className="p-8">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Settings</h1>
              <p className="text-text-tertiary text-sm mt-1.5">Configure exchange parameters and system settings</p>
            </div>
            <button 
              onClick={() => refetch()}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2.5 border border-border text-text-secondary rounded-xl hover:bg-hover text-sm transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Error State */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {/* Save Success */}
          {saveSuccess && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
              Settings saved successfully!
            </div>
          )}

          {/* Save Error */}
          {saveError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {saveError}
            </div>
          )}

          {/* Loading State */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-3">
              {/* Trading Settings */}
              <div className="bg-surface rounded-2xl border border-border p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-hover rounded-xl flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-text-tertiary" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-text-primary">Trading Settings</h2>
                    <p className="text-sm text-text-tertiary mt-1">Configure fees and trading parameters</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Maker Fee (%)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={getSetting('trading.makerFee', 0.08)}
                      onChange={(e) => handleChange('trading.makerFee', parseFloat(e.target.value))}
                      className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border focus:ring-2 focus:ring-primary/20 text-text-primary" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Taker Fee (%)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={getSetting('trading.takerFee', 0.10)}
                      onChange={(e) => handleChange('trading.takerFee', parseFloat(e.target.value))}
                      className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border focus:ring-2 focus:ring-primary/20 text-text-primary" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Minimum Order Size (USDT)</label>
                    <input 
                      type="number" 
                      value={getSetting('trading.minOrderSize', 10)}
                      onChange={(e) => handleChange('trading.minOrderSize', parseInt(e.target.value))}
                      className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border focus:ring-2 focus:ring-primary/20 text-text-primary" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Maximum Order Size (USDT)</label>
                    <input 
                      type="number" 
                      value={getSetting('trading.maxOrderSize', 1000000)}
                      onChange={(e) => handleChange('trading.maxOrderSize', parseInt(e.target.value))}
                      className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border focus:ring-2 focus:ring-primary/20 text-text-primary" 
                    />
                  </div>
                </div>
              </div>

              {/* Security Settings */}
              <div className="bg-surface rounded-2xl border border-border p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-hover rounded-xl flex items-center justify-center">
                    <Shield className="w-5 h-5 text-text-tertiary" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-text-primary">Security Settings</h2>
                    <p className="text-sm text-text-tertiary mt-1">Manage security and access controls</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-border">
                    <div>
                      <p className="font-medium text-text-primary">Two-Factor Authentication</p>
                      <p className="text-sm text-text-tertiary">Require 2FA for all admin accounts</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={getSetting('security.require2FA', true)}
                        onChange={(e) => handleChange('security.require2FA', e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-hover peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-border">
                    <div>
                      <p className="font-medium text-text-primary">IP Whitelist</p>
                      <p className="text-sm text-text-tertiary">Only allow access from whitelisted IPs</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={getSetting('security.ipWhitelist', true)}
                        onChange={(e) => handleChange('security.ipWhitelist', e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-hover peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-text-primary">Session Timeout (minutes)</p>
                      <p className="text-sm text-text-tertiary">Auto-logout after inactivity</p>
                    </div>
                    <input 
                      type="number" 
                      value={getSetting('security.sessionTimeout', 30)}
                      onChange={(e) => handleChange('security.sessionTimeout', parseInt(e.target.value))}
                      className="w-24 px-4 py-2.5 rounded-xl bg-surface border border-border focus:ring-2 focus:ring-primary/20 text-text-primary" 
                    />
                  </div>
                </div>
              </div>

              {/* Withdrawal Settings */}
              <div className="bg-surface rounded-2xl border border-border p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-hover rounded-xl flex items-center justify-center">
                    <Database className="w-5 h-5 text-text-tertiary" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-text-primary">Withdrawal Settings</h2>
                    <p className="text-sm text-text-tertiary mt-1">Configure withdrawal limits and approvals</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Daily Limit (USDT)</label>
                    <input 
                      type="number" 
                      value={getSetting('withdrawal.dailyLimit', 50000)}
                      onChange={(e) => handleChange('withdrawal.dailyLimit', parseInt(e.target.value))}
                      className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border focus:ring-2 focus:ring-primary/20 text-text-primary" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Manual Approval Threshold (USDT)</label>
                    <input 
                      type="number" 
                      value={getSetting('withdrawal.manualApprovalThreshold', 50000)}
                      onChange={(e) => handleChange('withdrawal.manualApprovalThreshold', parseInt(e.target.value))}
                      className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border focus:ring-2 focus:ring-primary/20 text-text-primary" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Minimum Withdrawal (USDT)</label>
                    <input 
                      type="number" 
                      value={getSetting('withdrawal.minWithdrawal', 20)}
                      onChange={(e) => handleChange('withdrawal.minWithdrawal', parseInt(e.target.value))}
                      className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border focus:ring-2 focus:ring-primary/20 text-text-primary" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Processing Time (hours)</label>
                    <input 
                      type="number" 
                      value={getSetting('withdrawal.processingTime', 24)}
                      onChange={(e) => handleChange('withdrawal.processingTime', parseInt(e.target.value))}
                      className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border focus:ring-2 focus:ring-primary/20 text-text-primary" 
                    />
                  </div>
                </div>
              </div>

              {/* Notification Settings */}
              <div className="bg-surface rounded-2xl border border-border p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-hover rounded-xl flex items-center justify-center">
                    <Bell className="w-5 h-5 text-text-tertiary" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-text-primary">Notification Settings</h2>
                    <p className="text-sm text-text-tertiary mt-1">Manage alert preferences</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-border">
                    <div>
                      <p className="font-medium text-text-primary">Large Withdrawal Alerts</p>
                      <p className="text-sm text-text-tertiary">Notify admins of withdrawals over threshold</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={getSetting('notifications.largeWithdrawalAlerts', true)}
                        onChange={(e) => handleChange('notifications.largeWithdrawalAlerts', e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-hover peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-border">
                    <div>
                      <p className="font-medium text-text-primary">KYC Application Notifications</p>
                      <p className="text-sm text-text-tertiary">Alert when new KYC applications arrive</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={getSetting('notifications.kycApplicationAlerts', true)}
                        onChange={(e) => handleChange('notifications.kycApplicationAlerts', e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-hover peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-text-primary">System Health Alerts</p>
                      <p className="text-sm text-text-tertiary">Notify of system performance issues</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={getSetting('notifications.systemHealthAlerts', true)}
                        onChange={(e) => handleChange('notifications.systemHealthAlerts', e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-hover peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end">
                <button 
                  onClick={handleSaveAll}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-colors font-medium disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Save className="w-5 h-5" />
                  )}
                  {isSaving ? 'Saving...' : 'Save All Settings'}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
