import type { ReactNode } from 'react';
import { AdminProvider } from './admin-client';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminProvider>{children}</AdminProvider>;
}
