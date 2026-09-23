import Image from 'next/image';

export function Logo({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-[var(--spacing-sm)] ${className ?? ''}`}>
      <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-full)] bg-[var(--color-bg-brand)]">
        <Image src="/brand/ufo.svg" alt="" width={24} height={24} />
      </div>
      <p className="whitespace-nowrap font-sans text-2xl italic leading-none tracking-[-1px] text-[color:var(--color-text-primary)]">
        Ovni<span className="text-[#c8f31d]">Sport</span>
      </p>
    </div>
  );
}
