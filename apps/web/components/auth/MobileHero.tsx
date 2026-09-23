import { Logo } from '@/components/ui/Logo';

export function MobileHero({ className }: { className?: string }) {
  return (
    <div className={`flex w-full flex-col items-start gap-5 ${className ?? ''}`}>
      <Logo />

      <div className="flex w-full flex-col gap-1">
        <p className="whitespace-nowrap font-sans text-[32px] italic leading-10 tracking-[-1px] text-[color:var(--color-text-secondary)]">
          Bienvenido de
        </p>
        <p className="whitespace-nowrap font-sans text-[32px] font-medium italic leading-10 tracking-[-1px] text-[color:var(--color-text-primary)]">
          vuelta a la cancha
        </p>
        <p className="w-full pt-2 font-sans text-sm text-[color:var(--color-text-secondary)]">
          Inicia sesión para gestionar tus torneos, equipos y partidos.
        </p>
      </div>
    </div>
  );
}
