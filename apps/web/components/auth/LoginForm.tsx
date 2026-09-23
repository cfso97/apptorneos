'use client';

import { useMutation } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { api, ApiError } from '@/lib/api';
import { saveSession, type AuthTokens } from '@/lib/auth';

interface LoginResponse extends AuthTokens {
  user: { id: string; email: string; nombre: string };
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const loginMutation = useMutation({
    mutationFn: () => api.post<LoginResponse>('/auth/login', { email, password }),
    onSuccess: (data) => {
      saveSession(data);
      router.push('/dashboard');
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    loginMutation.mutate();
  }

  const errorMessage =
    loginMutation.error instanceof ApiError ? loginMutation.error.message : loginMutation.error ? 'No pudimos conectar con el servidor.' : undefined;

  return (
    <div className="flex w-[400px] flex-col items-start gap-[var(--spacing-3xl)]">
      <div className="flex flex-col gap-[var(--spacing-sm)]">
        <h1 className="font-sans text-[28px] font-semibold leading-9 tracking-[-0.5px] text-[color:var(--color-text-primary)]">
          Inicia sesión
        </h1>
        <p className="font-sans text-sm text-[color:var(--color-text-secondary)]">
          Usa el correo con el que te registraste o te invitaron.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-[var(--spacing-lg)]">
        <TextField
          id="email"
          name="email"
          type="email"
          label="Correo electrónico"
          placeholder="Ej. nombre@club.com…"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <TextField
          id="password"
          name="password"
          type={showPassword ? 'text' : 'password'}
          label="Contraseña"
          placeholder="Tu contraseña…"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errorMessage}
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-full)]"
            >
              <Image src="/icons/eye.svg" alt="" width={20} height={20} />
            </button>
          }
        />

        <div className="flex w-full justify-end">
          <Link
            href="/forgot-password"
            className="flex h-11 items-center justify-center rounded-[var(--radius-full)] pl-[var(--spacing-xl)] font-sans text-sm font-medium text-[color:var(--color-text-brand)]"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        <div className="flex w-full flex-col items-center gap-[var(--spacing-md)] pt-[var(--spacing-md)]">
          <Button type="submit" isLoading={loginMutation.isPending}>
            {loginMutation.isPending ? 'Iniciando sesión…' : 'Iniciar sesión'}
          </Button>
          <div className="flex items-center gap-1">
            <p className="font-sans text-sm text-[color:var(--color-text-secondary)]">¿Nuevo en OvniSport?</p>
            <Link href="/register" className="font-sans text-sm font-medium text-[color:var(--color-text-brand)]">
              Crea tu organización
            </Link>
          </div>
        </div>
      </form>

      <div className="flex w-full items-center gap-[var(--spacing-sm)] rounded-[var(--radius-lg)] border border-solid border-[color:var(--color-border-subtle)] bg-[var(--color-bg-surface)] px-[var(--spacing-lg)] py-[var(--spacing-md)]">
        <Image src="/icons/users.svg" alt="" width={20} height={20} />
        <p className="flex-1 font-sans text-xs text-[color:var(--color-text-secondary)]">
          ¿Te invitaron a un equipo? Abre el enlace que recibiste por correo o WhatsApp.
        </p>
      </div>
    </div>
  );
}
