import Image from 'next/image';
import { Logo } from '@/components/ui/Logo';

export function MobileHero({ className }: { className?: string }) {
  return (
    <div className={`relative flex w-full flex-col items-start gap-5 overflow-hidden ${className ?? ''}`}>
      <div className="pointer-events-none absolute -top-24 left-[35%] size-[320px]">
        <Image src="/brand/glow-mobile.svg" alt="" fill />
      </div>
      <div className="pointer-events-none absolute -top-10 left-[10%] size-[300px] rotate-12">
        <Image src="/brand/pitch-lines-mobile.svg" alt="" fill />
      </div>

      <Logo className="relative" />

      <div className="relative flex w-full flex-col gap-1">
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
