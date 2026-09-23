import Image from 'next/image';

const LABEL_BY_STATUS = {
  live: 'En curso',
} as const;

type TournamentStatusChipProps = {
  status: keyof typeof LABEL_BY_STATUS;
};

export function TournamentStatusChip({ status }: TournamentStatusChipProps) {
  return (
    <div className="flex h-7 items-center gap-[var(--spacing-xs)] rounded-[var(--radius-full)] bg-[var(--color-bg-live)] px-[var(--spacing-md)]">
      <Image src="/icons/pulse-dot.svg" alt="" width={6} height={6} />
      <p className="whitespace-nowrap font-sans text-xs font-medium tracking-[0.2px] text-[color:var(--color-text-on-danger)]">
        {LABEL_BY_STATUS[status]}
      </p>
    </div>
  );
}
