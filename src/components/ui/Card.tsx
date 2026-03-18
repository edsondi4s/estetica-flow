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
        <div className={`bg-white dark:bg-slate-900 rounded-luxury border border-slate-100 dark:border-slate-800/50 shadow-sm overflow-hidden flex flex-col transition-all duration-300 hover:shadow-md ${className}`}>
            {(title || extra) && (
                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800/50 flex justify-between items-center bg-transparent transition-colors">
                    {title && <h3 className="text-xl font-serif font-medium text-slate-800 dark:text-white tracking-tight">{title}</h3>}
                    {extra && <div>{extra}</div>}
                </div>
            )}
            <div className={noPadding ? '' : 'p-6'}>
                {children}
            </div>
        </div>
    );
};
