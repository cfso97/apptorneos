import type { ButtonHTMLAttributes } from 'react';
import { Spinner } from '@/components/ui/Spinner';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  isLoading?: boolean;
};

export function Button({ isLoading, disabled, className, children, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      aria-disabled={disabled || isLoading}
      className={`flex h-[52px] w-full items-center justify-center gap-[var(--spacing-sm)] rounded-[var(--radius-full)] bg-[var(--color-bg-brand)] px-[var(--spacing-2xl)] font-sans text-base font-medium text-[color:var(--color-text-on-brand)] transition-[filter] duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-bg-brand)] active:scale-[0.97] disabled:cursor-not-allowed ${disabled ? 'disabled:opacity-50' : ''} ${className ?? ''}`}
    >
      {isLoading && <Spinner />}
      {children}
    </button>
  );
}
