import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
    label: string;
    value: string;
    subtitle?: string;
    icon: LucideIcon;
    trend?: string;
    color?: 'indigo' | 'emerald' | 'amber' | 'blue' | 'rose';
    onClick?: () => void;
}

export const StatCard = ({
    label,
    value,
    subtitle,
    icon: Icon,
    trend,
    color = 'indigo',
    onClick
}: StatCardProps) => {
    const colors = {
        indigo: {
            bg: 'bg-primary/5 dark:bg-primary/10',
            icon: 'text-primary dark:text-primary',
            border: 'border-primary/20 dark:border-primary/30',
        },
        emerald: {
            bg: 'bg-[var(--color-secondary)]/5 dark:bg-[var(--color-secondary)]/10',
            icon: 'text-[var(--color-secondary)] dark:text-[var(--color-secondary)]',
            border: 'border-[var(--color-secondary)]/20 dark:border-[var(--color-secondary)]/30',
        },
        amber: {
            bg: 'bg-amber-50 dark:bg-amber-900/20',
            icon: 'text-amber-600 dark:text-amber-500',
            border: 'border-amber-100 dark:border-amber-800',
        },
        blue: {
            bg: 'bg-blue-50 dark:bg-blue-900/20',
            icon: 'text-blue-600 dark:text-blue-500',
            border: 'border-blue-100 dark:border-blue-800',
        },
        rose: {
            bg: 'bg-rose-50 dark:bg-rose-900/20',
            icon: 'text-rose-600 dark:text-rose-500',
            border: 'border-rose-100 dark:border-rose-800',
        },
    };

    const isNegativeTrend = trend?.startsWith('-');

    return (
        <div
            onClick={onClick}
            className={`group relative p-6 bg-white dark:bg-slate-900 rounded-luxury border border-slate-100 dark:border-slate-800/50 transition-all duration-300 shadow-sm ${onClick ? 'cursor-pointer hover:shadow-md hover:border-primary/30 dark:hover:border-primary/30' : ''}`}
        >
            <div className="flex justify-between items-start mb-6 relative z-10">
                <div className={`w-12 h-12 ${colors[color].bg} border ${colors[color].border} flex items-center justify-center rounded-2xl group-hover:scale-110 transition-transform duration-500`}>
                    <Icon className={`${colors[color].icon} w-6 h-6`} />
                </div>

                {trend && (
                    <div className="flex flex-col items-end">
                        <span className={`text-xs font-semibold flex items-center gap-1 ${isNegativeTrend ? 'text-red-500' : 'text-emerald-500'}`}>
                            {isNegativeTrend ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                            {trend}
                        </span>
                    </div>
                )}
            </div>

            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-1">
                    <p className="text-slate-500 dark:text-slate-400 text-xs font-medium tracking-wide">{label}</p>
                </div>
                <h3 className="text-slate-900 dark:text-white pb-1 text-3xl font-serif tracking-tight flex items-baseline gap-2">
                    {value}
                    {subtitle && <span className="text-xs font-light text-slate-400 dark:text-slate-500">{subtitle}</span>}
                </h3>
            </div>
        </div>
    );
};
