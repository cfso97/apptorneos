import Image from 'next/image';

export function Spinner({ className }: { className?: string }) {
  return (
    <Image
      src="/icons/spinner.svg"
      alt=""
      width={20}
      height={20}
      className={`shrink-0 motion-safe:animate-spin motion-safe:[animation-duration:700ms] motion-reduce:animate-pulse ${className ?? ''}`}
    />
  );
}
