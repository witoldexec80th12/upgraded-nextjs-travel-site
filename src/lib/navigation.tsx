'use client';

import NextLink from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, type ComponentProps } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { localizedHref } from '@/lib/public-routing';

/** Public-site links retain the current locale, just as the old router did. */
export function useLocalizedHref() {
  const { locale } = useI18n();
  return useCallback((href: string) => {
    return localizedHref(href, locale);
  }, [locale]);
}

export function Link({ href, ...props }: Omit<ComponentProps<typeof NextLink>, 'href'> & { href: string }) {
  const localize = useLocalizedHref();
  return <NextLink href={localize(href)} {...props} />;
}

export function useLocation(): [string, (href: string) => void] {
  const pathname = usePathname();
  const router = useRouter();
  const localize = useLocalizedHref();
  const navigate = useCallback((href: string) => router.push(localize(href)), [router, localize]);
  return [pathname, navigate];
}
