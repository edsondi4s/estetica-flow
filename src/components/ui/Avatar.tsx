interface AvatarProps {
    src?: string;
    name: string;
    initials?: string;
    color?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}

export const Avatar = ({
    src,
    name,
    initials,
    color = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
    size = 'md',
    className = ''
}: AvatarProps) => {
    const computedInitials = initials || (name || '?')
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);

    const sizes = {
        sm: 'w-6 h-6 text-[10px]',
        md: 'w-8 h-8 text-xs',
        lg: 'w-10 h-10 text-sm',
        xl: 'w-16 h-16 text-xl',
    };

    if (src) {
        return (
            <div
                className={`${sizes[size]} rounded-full bg-slate-200 dark:bg-slate-700 bg-cover bg-center border border-slate-100 dark:border-slate-800 ring-4 ring-white dark:ring-slate-900 shadow-sm transition-all ${className}`}
                style={{ backgroundImage: `url(${src})` }}
                title={name}
            />
        );
    }

    return (
        <div className={`${sizes[size]} rounded-full flex items-center justify-center font-bold ${color} ring-4 ring-white dark:ring-slate-900 shadow-sm transition-all ${className}`}>
            {computedInitials}
        </div>
    );
};
