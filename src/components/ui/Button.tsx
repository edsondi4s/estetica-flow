import React, { ReactNode, ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'icon';
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  isLoading?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}

import { Loader2 } from 'lucide-react';

export const Button = ({
  children,
  variant = 'primary',
  className = '',
  size = 'md',
  isLoading = false,
  disabled = false,
  ...props
}: ButtonProps) => {
  const baseStyles = 'inline-flex items-center justify-center font-bold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] outline-none';

  const variants = {
    primary: 'bg-primary hover:bg-primary-dark text-white shadow-[0_4px_20px_rgba(219,39,119,0.3)] hover:shadow-[0_8px_30px_rgba(219,39,119,0.4)]',
    secondary: 'bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20',
    outline: 'border border-slate-200 dark:border-slate-800 hover:border-primary/50 text-slate-600 dark:text-slate-400 hover:text-primary',
    ghost: 'text-slate-500 hover:text-primary hover:bg-primary/5',
    danger: 'bg-rose-500 hover:bg-rose-600 text-white shadow-[0_4px_20px_rgba(244,63,94,0.3)] hover:shadow-[0_8px_30px_rgba(244,63,94,0.4)]',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs rounded-sm',
    md: 'px-5 py-2.5 text-sm rounded-sm',
    lg: 'px-8 py-3 text-sm rounded-sm uppercase tracking-widest',
    icon: 'p-2 rounded-sm',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
      {children}
    </button>
  );
};
