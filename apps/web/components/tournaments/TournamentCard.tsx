import { TeamCrest } from './TeamCrest';
import { TournamentStatusChip } from './TournamentStatusChip';

type Team = { name: string; initials: string };

type TournamentCardProps = {
  title: string;
  subtitle: string;
  homeTeam: Team;
  awayTeam: Team;
  score: string;
  period: string;
  className?: string;
};

export function TournamentCard({ title, subtitle, homeTeam, awayTeam, score, period, className }: TournamentCardProps) {
  return (
    <div
      className={`flex w-[343px] flex-col items-start gap-[var(--spacing-lg)] rounded-[var(--radius-2xl)] bg-[var(--color-bg-brand)] p-[var(--spacing-xl)] drop-shadow-[0px_0px_16px_rgba(200,243,29,0.28)] ${className ?? ''}`}
    >
      <div className="flex w-full items-center gap-[var(--spacing-sm)]">
        <div className="flex flex-1 flex-col gap-[2px] text-[color:var(--color-text-on-brand)]">
          <p className="font-sans text-base font-medium leading-6">{title}</p>
          <p className="font-sans text-xs tracking-[0.2px]">{subtitle}</p>
        </div>
        <TournamentStatusChip status="live" />
      </div>
      <div className="flex w-full items-center justify-between">
        <div className="flex w-[88px] flex-col items-center gap-[var(--spacing-sm)]">
          <TeamCrest initials={homeTeam.initials} />
          <p className="text-center font-sans text-sm font-medium text-[color:var(--color-text-on-brand)]">{homeTeam.name}</p>
        </div>
        <div className="flex flex-col items-center text-[color:var(--color-text-on-brand)]">
          <p className="font-sans text-xs tracking-[0.2px]">{period}</p>
          <p className="font-condensed text-4xl font-semibold leading-[44px]">{score}</p>
        </div>
        <div className="flex w-[88px] flex-col items-center gap-[var(--spacing-sm)]">
          <TeamCrest initials={awayTeam.initials} />
          <p className="text-center font-sans text-sm font-medium text-[color:var(--color-text-on-brand)]">{awayTeam.name}</p>
        </div>
      </div>
    </div>
  );
}
