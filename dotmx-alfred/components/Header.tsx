'use client';

import { useState } from 'react';
import { Bell, Search, User, LogOut, Settings } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

export default function Header() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <header className="bg-background border-b border-border px-8 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-focus-ring focus:border-transparent transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="relative p-2.5 hover:bg-hover rounded-xl transition-all duration-200">
            <Bell className="w-4 h-4 text-text-secondary" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-error rounded-full"></span>
          </button>

          <div className="relative pl-3 ml-3 border-l border-border">
            <button 
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-3 hover:bg-hover rounded-xl p-2 transition-all"
            >
              <div className="text-right">
                <p className="text-sm font-medium text-text-primary">{user?.name || 'Admin User'}</p>
                <p className="text-xs text-text-tertiary">{user?.email || 'admin@dotmx.com'}</p>
              </div>
              <div className="w-9 h-9 bg-secondary rounded-xl flex items-center justify-center ring-1 ring-border">
                <User className="w-4 h-4 text-text-secondary" />
              </div>
            </button>

            {/* Dropdown Menu */}
            {showDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowDropdown(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-56 bg-surface border border-border rounded-xl shadow-lg z-20 overflow-hidden">
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      router.push('/profile');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-hover transition-all text-left"
                  >
                    <Settings className="w-4 h-4 text-text-secondary" />
                    <span className="text-sm text-text-primary">Profile Settings</span>
                  </button>
                  <div className="h-px bg-border" />
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-hover transition-all text-left text-error"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm">Logout</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
