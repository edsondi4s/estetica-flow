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
            bg: 'bg-indigo-50 dark:bg-indigo-500/10',
            icon: 'text-indigo-600 dark:text-indigo-400',
            border: 'border-indigo-100 dark:border-indigo-500/20',
            bgHover: 'group-hover:bg-indigo-100 dark:group-hover:bg-indigo-500/20'
        },
        emerald: {
            bg: 'bg-emerald-50 dark:bg-emerald-500/10',
            icon: 'text-emerald-600 dark:text-emerald-400',
            border: 'border-emerald-100 dark:border-emerald-500/20',
            bgHover: 'group-hover:bg-emerald-100 dark:group-hover:bg-emerald-500/20'
        },
        amber: {
            bg: 'bg-amber-50 dark:bg-amber-500/10',
            icon: 'text-amber-600 dark:text-amber-400',
            border: 'border-amber-100 dark:border-amber-500/20',
            bgHover: 'group-hover:bg-amber-100 dark:group-hover:bg-amber-500/20'
        },
        blue: {
            bg: 'bg-blue-50 dark:bg-blue-500/10',
            icon: 'text-blue-600 dark:text-blue-400',
            border: 'border-blue-100 dark:border-blue-500/20',
            bgHover: 'group-hover:bg-blue-100 dark:group-hover:bg-blue-500/20'
        },
        rose: {
            bg: 'bg-rose-50 dark:bg-rose-500/10',
            icon: 'text-rose-600 dark:text-rose-400',
            border: 'border-rose-100 dark:border-rose-500/20',
            bgHover: 'group-hover:bg-rose-100 dark:group-hover:bg-rose-500/20'
        },
    };

    const isNegativeTrend = trend?.startsWith('-');

    return (
        <div
            onClick={onClick}
            className={`bg-white dark:bg-slate-900/50 backdrop-blur-sm rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-800/60 transition-all duration-300 group ${onClick ? 'cursor-pointer hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1' : 'hover:shadow-xl hover:shadow-primary/5'}`}
        >
            <div className="flex justify-between items-start mb-5">
                <div className={`w-14 h-14 rounded-2xl ${colors[color].bg} ${colors[color].border} border flex items-center justify-center ${colors[color].bgHover} transition-all duration-300 shadow-sm shadow-black/5`}>
                    <Icon className={`${colors[color].icon} w-7 h-7`} />
                </div>
                {trend && (
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg flex items-center gap-1 border ${isNegativeTrend
                            ? 'bg-rose-100 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/10'
                            : 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/10'
                        }`}>
                        {isNegativeTrend ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />} {trend}
                    </span>
                )}
            </div>
            <div>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest mb-1.5">{label}</p>
                <h3 className="text-slate-900 dark:text-white text-3xl font-black tracking-tight flex items-baseline gap-2">
                    {value}
                    {subtitle && <span className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase">{subtitle}</span>}
                </h3>
            </div>
        </div>
    );
};
