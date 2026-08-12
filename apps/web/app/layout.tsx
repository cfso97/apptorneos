import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Torneos SaaS — Panel del organizador',
  description: 'Gestión de torneos, equipos y jugadores multi-organización',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
