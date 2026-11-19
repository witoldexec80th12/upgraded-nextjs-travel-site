import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SITE } from '@/config/site';
import { getEventConfig } from '@/content';
import { getThemeCss } from '@/lib/site-pages';
import '@/index.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE.origin),
  applicationName: getEventConfig(SITE.defaultLanguage).brand.name,
  icons: { icon: SITE.organization.logoPath },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang={SITE.defaultLanguage} data-scroll-behavior="smooth">
    <body>
      <style dangerouslySetInnerHTML={{ __html: getThemeCss(SITE.defaultLanguage) }} />
      {children}
    </body>
  </html>;
}
