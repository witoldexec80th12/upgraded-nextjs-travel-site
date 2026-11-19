'use client';

import type { ReactNode } from 'react';
import { I18nProvider } from '@/i18n/I18nContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { Analytics } from '@/components/seo/Analytics';
import type { Messages } from '@/i18n/messages';

export function SiteProvider({ children, locale, messages }: {
  children: ReactNode; locale: string; messages: Messages;
}) {
  return <I18nProvider locale={locale} messages={messages}>
    <TooltipProvider>{children}<Toaster /><Analytics /></TooltipProvider>
  </I18nProvider>;
}
