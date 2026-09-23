import type { Metadata } from 'next';
import { BrandPanel } from '@/components/auth/BrandPanel';
import { LoginForm } from '@/components/auth/LoginForm';

export const metadata: Metadata = {
  title: 'Iniciar sesión — Torneos SaaS',
};

export default function LoginPage() {
  return (
    <div className="flex h-screen items-start bg-[var(--color-bg-canvas)] py-4 pl-4">
      <BrandPanel />
      <div className="flex h-full flex-1 items-center justify-center">
        <LoginForm />
      </div>
    </div>
  );
}
