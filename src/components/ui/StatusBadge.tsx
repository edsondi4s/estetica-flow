type StatusType = 'Confirmado' | 'Pendente' | 'Concluído' | 'Cancelado' | string;

interface StatusBadgeProps {
    status: StatusType;
}

export const StatusBadge = ({ status }: StatusBadgeProps) => {
    const styles: Record<string, string> = {
        'Confirmado': 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400',
        'Pendente': 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400',
        'Concluído': 'bg-sky-100 dark:bg-sky-900/30 text-sky-800 dark:text-sky-400',
        'Finalizado': 'bg-sky-100 dark:bg-sky-900/30 text-sky-800 dark:text-sky-400',
        'Cancelado': 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400',
        'Expirado': 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
    };

    const currentStyle = styles[status] || 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300';

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${currentStyle}`}>
            {status}
        </span>
    );
};
