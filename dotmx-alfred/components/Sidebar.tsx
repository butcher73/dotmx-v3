'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  ArrowLeftRight,
  Coins,
  Wallet,
  Settings,
  BarChart3,
  FileText,
  Shield,
  UserCircle,
  Link2,
  Boxes,
  Activity,
} from 'lucide-react';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/' },
  { icon: Users, label: 'Users', href: '/users' },
  { icon: ArrowLeftRight, label: 'Transactions', href: '/transactions' },
  { icon: Coins, label: 'Trading Pairs', href: '/trading-pairs' },
  { icon: Activity, label: 'Market Data', href: '/market-data' },
  { icon: Boxes, label: 'Tokens', href: '/tokens' },
  { icon: Link2, label: 'Chains', href: '/chains' },
  { icon: Wallet, label: 'Deposits & Withdrawals', href: '/deposits-withdrawals' },
  { icon: BarChart3, label: 'Analytics', href: '/analytics' },
  { icon: Shield, label: 'KYC Management', href: '/kyc' },
  { icon: FileText, label: 'Audit Logs', href: '/audit-logs' },
  { icon: Settings, label: 'Settings', href: '/settings' },
  { icon: UserCircle, label: 'Profile', href: '/profile' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-background text-text-primary min-h-screen p-6 border-r border-border">
      <div className="mb-12">
        <h1 className="text-xl font-semibold text-text-primary tracking-tight">DotMX</h1>
        <p className="text-xs text-text-tertiary mt-1.5 font-medium">ALFRED</p>
      </div>

      <nav className="space-y-0.5">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                isActive
                  ? 'bg-secondary text-secondary-foreground font-medium'
                  : 'text-text-secondary hover:bg-hover hover:text-text-primary'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
