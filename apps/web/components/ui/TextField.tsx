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
          error ? 'border-2 border-[#d92d22]' : 'border-[color:var(--color-border-strong)]'
        }`}
      >
        <input
          {...props}
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={errorId}
          className={`min-w-0 flex-1 bg-transparent font-sans text-base text-[color:var(--color-text-primary)] outline-none placeholder:text-[color:var(--color-text-tertiary)] ${className ?? ''}`}
        />
        {trailing}
      </div>
      {error && (
        <p id={errorId} className="text-sm text-[#d92d22]">
          {error}
        </p>
      )}
    </div>
  );
}
