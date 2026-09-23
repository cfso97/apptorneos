import type { Metadata } from 'next';
import Image from 'next/image';
import { BrandPanel } from '@/components/auth/BrandPanel';
import { LoginForm } from '@/components/auth/LoginForm';

export const metadata: Metadata = {
  title: 'Iniciar sesión — Torneos SaaS',
};

export default function LoginPage() {
  return (
    <div className="relative isolate flex min-h-screen flex-col overflow-x-hidden bg-[var(--color-bg-canvas)] lg:h-screen lg:flex-row lg:items-start lg:py-4 lg:pl-4">
      {/* Fondo decorativo de la variante móvil: va pegado al borde superior y
          a los bordes laterales de la pantalla, fuera del padding del formulario. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 lg:hidden">
        <div className="absolute -top-24 left-[35%] size-[320px]">
          <Image src="/brand/glow-mobile.svg" alt="" fill />
        </div>
        <div className="absolute -top-10 left-[10%] size-[300px] rotate-12">
          <Image src="/brand/pitch-lines-mobile.svg" alt="" fill />
        </div>
      </div>

      <div className="hidden h-full flex-1 lg:flex">
        <BrandPanel />
      </div>
      <div className="flex flex-1 flex-col lg:h-full lg:items-center lg:justify-center">
        <LoginForm />
      </div>
    </div>
  );
}
