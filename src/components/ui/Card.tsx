import { ReactNode } from 'react';

interface CardProps {
    children: ReactNode;
    title?: string;
    extra?: ReactNode;
    className?: string;
    noPadding?: boolean;
}

export const Card = ({ children, title, extra, className = '', noPadding = false }: CardProps) => {
    return (
        <div className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col transition-colors ${className}`}>
            {(title || extra) && (
                <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 transition-colors">
                    {title && <h3 className="text-lg font-bold text-slate-800 dark:text-white">{title}</h3>}
                    {extra && <div>{extra}</div>}
                </div>
            )}
            <div className={noPadding ? '' : 'p-6'}>
                {children}
            </div>
        </div>
    );
};
