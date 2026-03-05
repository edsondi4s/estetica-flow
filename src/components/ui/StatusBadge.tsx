type StatusType = 'Confirmado' | 'Pendente' | 'Concluído' | 'Cancelado' | string;

interface StatusBadgeProps {
    status: StatusType;
}

export const StatusBadge = ({ status }: StatusBadgeProps) => {
    const styles: Record<string, string> = {
        'Confirmado': 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400',
        'Pendente': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400',
        'Concluído': 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400',
        'Cancelado': 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400',
    };

    const currentStyle = styles[status] || 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300';

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${currentStyle}`}>
            {status}
        </span>
    );
};
