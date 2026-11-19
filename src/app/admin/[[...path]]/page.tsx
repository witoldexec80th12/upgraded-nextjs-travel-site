import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SITE } from '@/config/site';
import { AdminClient } from '../admin-client';

export const metadata: Metadata = {
  title: 'Alta Via 1 — Private availability console',
  robots: { index: false, follow: false },
};

export default async function AdminPage({ params }: { params: Promise<{ path?: string[] }> }) {
  if (!SITE.features.hutAdmin) notFound();
  const path = (await params).path ?? [];
  if (path.length && !(path.length === 1 && path[0] === 'login') &&
    !(path.length === 2 && ['jobs', 'history'].includes(path[0]))) notFound();
  return <AdminClient />;
}
