import type { Metadata } from 'next';
import { BrandPanel } from '@/components/auth/BrandPanel';
import { LoginForm } from '@/components/auth/LoginForm';

export const metadata: Metadata = {
  title: 'Iniciar sesión — Torneos SaaS',
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg-canvas)] lg:h-screen lg:flex-row lg:items-start lg:py-4 lg:pl-4">
      <div className="hidden h-full flex-1 lg:flex">
        <BrandPanel />
      </div>
      <div className="flex flex-1 flex-col lg:h-full lg:items-center lg:justify-center">
        <LoginForm />
      </div>
    </div>
  );
}
