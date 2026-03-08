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
            bg: 'bg-indigo-50 dark:bg-slate-900',
            icon: 'text-indigo-600 dark:text-indigo-500',
            border: 'border-indigo-100 dark:border-slate-800',
        },
        emerald: {
            bg: 'bg-emerald-50 dark:bg-slate-900',
            icon: 'text-emerald-600 dark:text-emerald-500',
            border: 'border-emerald-100 dark:border-slate-800',
        },
        amber: {
            bg: 'bg-amber-50 dark:bg-slate-900',
            icon: 'text-amber-600 dark:text-amber-500',
            border: 'border-amber-100 dark:border-slate-800',
        },
        blue: {
            bg: 'bg-blue-50 dark:bg-slate-900',
            icon: 'text-sky-600 dark:text-sky-500',
            border: 'border-blue-100 dark:border-slate-800',
        },
        rose: {
            bg: 'bg-rose-50 dark:bg-slate-900',
            icon: 'text-rose-600 dark:text-rose-500',
            border: 'border-rose-100 dark:border-slate-800',
        },
    };

    const isNegativeTrend = trend?.startsWith('-');

    return (
        <div
            onClick={onClick}
            className={`group relative p-6 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-900 transition-all duration-500 ${onClick ? 'cursor-pointer hover:border-primary/50' : ''}`}
        >

            <div className="flex justify-between items-start mb-8 relative z-10">
                <div className={`w-14 h-14 ${colors[color].bg} border ${colors[color].border} flex items-center justify-center rounded-sm group-hover:scale-110 transition-transform duration-500 shadow-sm`}>
                    <Icon className={`${colors[color].icon} w-8 h-8`} />
                </div>

                {trend && (
                    <div className="flex flex-col items-end">
                        <span className={`text-[10px] font-black uppercase tracking-tighter flex items-center gap-1 ${isNegativeTrend ? 'text-red-500' : 'text-emerald-500'}`}>
                            {isNegativeTrend ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                            {trend}
                        </span>
                        <div className="h-[1px] w-8 bg-slate-100 dark:bg-slate-900 mt-1"></div>
                    </div>
                )}
            </div>

            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-1 h-3 bg-primary/20"></div>
                    <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">{label}</p>
                </div>
                <h3 className="text-slate-950 dark:text-white text-3xl font-black tracking-tighter flex items-baseline gap-2 uppercase">
                    {value}
                    {subtitle && <span className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">{subtitle}</span>}
                </h3>
            </div>
        </div>
    );
};
