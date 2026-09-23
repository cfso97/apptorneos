import Image from 'next/image';
import { Logo } from '@/components/ui/Logo';
import { TournamentCard } from '@/components/tournaments/TournamentCard';

const STATS = [
  { value: '120+', label: 'torneos activos' },
  { value: '1.8K', label: 'equipos' },
  { value: '24K', label: 'partidos jugados' },
];

export function BrandPanel() {
  return (
    <div className="relative flex h-full flex-1 flex-col items-start justify-between overflow-hidden rounded-[var(--radius-2xl)] bg-[var(--color-bg-surface)] p-[var(--spacing-5xl)]">
      <div className="pointer-events-none absolute -top-40 left-[260px] size-[560px]">
        <Image src="/brand/glow.svg" alt="" fill />
      </div>
      <div className="pointer-events-none absolute left-[300px] top-[300px] size-[520px]">
        <Image src="/brand/pitch-lines.svg" alt="" fill />
      </div>

      <Logo className="relative" />

      <div className="relative flex flex-col items-start gap-[var(--spacing-3xl)]">
        <div className="flex flex-col gap-1">
          <p className="font-sans text-5xl italic leading-[56px] tracking-[-1px] text-[color:var(--color-text-secondary)] 2xl:whitespace-nowrap">
            Organiza.
          </p>
          <p className="font-sans text-5xl font-medium italic leading-[56px] tracking-[-1px] text-[color:var(--color-text-primary)] 2xl:whitespace-nowrap">
            Compite. Vive el marcador.
          </p>
          <p className="w-full max-w-[520px] font-sans text-base text-[color:var(--color-text-secondary)]">
            Torneos, inscripciones, calendario y resultados en vivo para tu organización, en un solo lugar.
          </p>
        </div>

        <TournamentCard
          title="Copa Barrial 2026"
          subtitle="Fútbol 7 · Jornada 2"
          homeTeam={{ name: 'Leones', initials: 'LN' }}
          awayTeam={{ name: 'Tigres', initials: 'TC' }}
          score="3 : 2"
          period="1T · 58'"
        />
      </div>

      <div className="relative flex gap-[var(--spacing-4xl)]">
        {STATS.map((stat) => (
          <div key={stat.label} className="flex flex-col items-start">
            <p className="font-condensed text-2xl font-semibold leading-7 text-[color:var(--color-text-primary)]">
              {stat.value}
            </p>
            <p className="font-sans text-xs tracking-[0.2px] text-[color:var(--color-text-tertiary)]">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
