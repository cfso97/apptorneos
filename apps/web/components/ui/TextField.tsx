import Image from 'next/image';
import type { InputHTMLAttributes, ReactNode } from 'react';

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  error?: string;
  trailing?: ReactNode;
};

export function TextField({ id, label, error, trailing, className, ...props }: TextFieldProps) {
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="flex w-full flex-col gap-[var(--spacing-sm)]">
      <label htmlFor={id} className="text-sm font-medium text-[color:var(--color-text-secondary)]">
        {label}
      </label>
      <div
        className={`flex h-[52px] w-full items-center gap-[var(--spacing-md)] rounded-[var(--radius-lg)] border border-solid bg-[var(--color-bg-input)] px-[var(--spacing-lg)] ${
          error ? 'border-2 border-[color:var(--color-border-danger)]' : 'border-[color:var(--color-border-strong)]'
        }`}
      >
        <input
          {...props}
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={errorId}
          className={`min-w-0 flex-1 bg-transparent font-sans text-base text-[color:var(--color-text-primary)] outline-none placeholder:text-[color:var(--color-text-tertiary)] disabled:cursor-not-allowed disabled:opacity-60 ${className ?? ''}`}
        />
        {trailing}
        {error && (
          <Image src="/icons/field-error-trailing.svg" alt="" width={20} height={20} className="shrink-0" />
        )}
      </div>
      {error && (
        <p id={errorId} className="flex items-center gap-[var(--spacing-xs)] text-xs tracking-[0.2px] text-[color:var(--color-text-danger)]">
          <Image src="/icons/alert-circle.svg" alt="" width={16} height={16} className="shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
