import React, { InputHTMLAttributes } from 'react';
import { LucideIcon } from 'lucide-react';

interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    icon?: LucideIcon;
    as?: 'input' | 'textarea';
    rows?: number;
    className?: string;
    placeholder?: string;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    type?: string;
    required?: boolean;
    defaultValue?: string;
    step?: string;
    maxLength?: number;
}

export const InputField = ({
    label,
    icon: Icon,
    className = '',
    as: Component = 'input',
    type,
    value,
    onChange,
    ...props
}: InputFieldProps) => {
    // Separate props to avoid passing rows to input
    const inputProps = Component === 'textarea' ? props : { ...props, rows: undefined };

    const formatPhone = (val: string) => {
        const numbers = val.replace(/\D/g, '');
        if (numbers.length <= 2) return numbers;
        if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
        return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (type === 'tel' && onChange) {
            const formattedValue = formatPhone(e.target.value);
            e.target.value = formattedValue;
            onChange(e);
        } else if (onChange) {
            onChange(e);
        }
    };

    return (
        <div className="space-y-1 w-full">
            {label && <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</label>}
            <div className="relative">
                {Icon && (
                    <Icon className={`absolute left-3 ${Component === 'textarea' ? 'top-3' : 'top-1/2 -translate-y-1/2'} w-5 h-5 text-slate-400`} />
                )}
                <Component
                    className={`
            w-full ${Icon ? 'pl-10' : 'px-4'} pr-4 py-2.5 
            bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm 
            text-slate-900 dark:text-slate-100
            outline-none focus:ring-2 focus:ring-primary/50 transition-all
            placeholder:text-slate-400 dark:placeholder:text-slate-500
            ${className}
          `}
                    type={type}
                    value={value}
                    onChange={handleChange}
                    {...inputProps as any}
                />
            </div>
        </div>
    );
};
