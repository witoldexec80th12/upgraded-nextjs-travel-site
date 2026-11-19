'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminApp from '@/admin/AdminApp';

/** Session/query state survives navigation between Next.js admin pages. */
export function AdminProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export function AdminClient() { return <AdminApp />; }
