'use client';

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { locales } from '@/lib/routes';
import { getArticleLocalePathsForPath } from '@/lib/article-routes';
import { translate, type Messages } from './messages';

export { locales };
type I18nValue = {
  locale: string;
  messages: Messages;
  setLocale: (locale: string) => void;
  t: (key: string, variables?: Record<string, string | number>) => string;
};
const I18nContext = createContext<I18nValue | null>(null);

/** Messages arrive with the server-rendered page; there is no blank translation pass. */
export function I18nProvider({ children, locale, messages }: {
  children: ReactNode; locale: string; messages: Messages;
}) {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);

  const setLocale = (nextLocale: string) => {
    const suffixParams = window.location.search + window.location.hash;
    const articles = getArticleLocalePathsForPath(pathname);
    if (articles) {
      const target = articles[nextLocale] ?? articles.en;
      if (target) router.push(target + suffixParams);
      return;
    }
    if (!locales.includes(nextLocale)) return;
    const parts = pathname.split('/').filter(Boolean);
    if (locales.includes(parts[0])) parts.shift();
    const suffix = parts.join('/');
    router.push(`/${nextLocale}${suffix ? `/${suffix}` : ''}${suffixParams}`);
  };

  return <I18nContext.Provider value={{
    locale, messages, setLocale, t: (key, variables) => translate(messages, key, variables),
  }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used within I18nProvider');
  return context;
}
