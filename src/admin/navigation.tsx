'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export function useLocation(): [string, (href: string) => void] {
  const pathname = usePathname();
  const router = useRouter();
  return [pathname, (href) => router.push(href)];
}

export function Redirect({ to }: { to: string }) {
  const router = useRouter();
  useEffect(() => { router.replace(to); }, [router, to]);
  return null;
}
