type TeamCrestProps = {
  initials: string;
  className?: string;
};

export function TeamCrest({ initials, className }: TeamCrestProps) {
  return (
    <div
      className={`flex size-16 shrink-0 items-center justify-center rounded-[var(--radius-full)] border-[3px] border-solid border-[color:var(--color-border-strong)] bg-[var(--color-bg-inverse)] ${className ?? ''}`}
    >
      <div className="flex size-14 items-center justify-center overflow-hidden rounded-[var(--radius-full)] bg-[var(--color-bg-brand-muted)]">
        <p className="font-sans text-base font-medium text-[color:var(--color-text-brand)]">{initials}</p>
      </div>
    </div>
  );
}
