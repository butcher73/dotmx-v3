import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
}

export default function StatCard({
  title,
  value,
  change,
  changeType = 'neutral',
  icon: Icon,
}: StatCardProps) {
  const changeColors = {
    positive: 'text-green-600 bg-green-50',
    negative: 'text-red-600 bg-red-50',
    neutral: 'text-zinc-600 bg-zinc-50',
  };

  return (
    <div className="bg-surface rounded-2xl border border-border p-6 hover:border-border-subtle transition-all duration-200">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider">{title}</p>
          <p className="text-3xl font-semibold text-text-primary mt-3 tracking-tight">{value}</p>
          {change && (
            <p className={`text-xs font-medium mt-3 inline-block px-2 py-1 rounded-lg ${changeColors[changeType]}`}>
              {change}
            </p>
          )}
        </div>
        <div className="w-11 h-11 bg-secondary rounded-xl flex items-center justify-center ring-1 ring-border">
          <Icon className="w-5 h-5 text-text-muted" />
        </div>
      </div>
    </div>
  );
}
