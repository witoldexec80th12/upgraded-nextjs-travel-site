import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { SiteProvider } from '@/app/site-provider';
import { getMessages } from '@/i18n/messages';
import { getThemeCss } from '@/lib/site-pages';
import { publicLocales } from '@/lib/public-routing';

export const dynamicParams = false;
export function generateStaticParams() {
  return publicLocales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: {
  children: ReactNode; params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!publicLocales.includes(locale)) notFound();
  return <SiteProvider locale={locale} messages={getMessages(locale)}>
    <div lang={locale}>
      <style dangerouslySetInnerHTML={{ __html: getThemeCss(locale) }} />
      {children}
    </div>
  </SiteProvider>;
}
