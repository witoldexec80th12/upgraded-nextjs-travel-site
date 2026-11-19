'use client';

import { Link } from '@/lib/navigation';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/i18n/I18nContext';
import { getEventConfig } from '@/content';
import { LanguageSwitcher } from './LanguageSwitcher';
import { getSiteNavigationTarget } from '@/lib/localized-navigation';
import { SITE } from '@/config/site';

export function Header() {
  const { locale, t } = useI18n();
  const config = getEventConfig(locale);
  const pathname = usePathname();
  const navTarget = (href: string) => getSiteNavigationTarget(pathname, href, locale);
  const homeTarget = navTarget('/');
  const ticketsTarget = navTarget('/#tickets');

  return (
    <header className="sticky top-0 z-50 w-full border-b" style={{ backgroundColor: `hsl(${config.brand.colors.headerBg})`, color: `hsl(${config.brand.colors.headerText})` }}>
      <div className="container mx-auto px-4 h-16 md:h-20 flex items-center justify-between">
        {homeTarget.useFullNavigation ? (
          <a href={homeTarget.href} className="flex items-center gap-3">
            {config.brand.logoUrl && <img src={config.brand.logoUrl} alt={config.brand.name} className="h-10 w-10 object-contain" />}
            <span className="font-serif text-xl md:text-2xl font-bold tracking-tight">{config.brand.logoText}</span>
          </a>
        ) : (
          <Link href={homeTarget.href} className="flex items-center gap-3">
            {config.brand.logoUrl && <img src={config.brand.logoUrl} alt={config.brand.name} className="h-10 w-10 object-contain" />}
            <span className="font-serif text-xl md:text-2xl font-bold tracking-tight">{config.brand.logoText}</span>
          </Link>
        )}
        <nav className="flex items-center gap-4 md:gap-8">
          {SITE.navigation.header.map((item) => {
            const target = navTarget(item.href);
            const className = 'hidden md:block text-sm font-semibold tracking-wide hover:opacity-75 transition-opacity';
            return target.useFullNavigation
              ? <a key={item.href} href={target.href} className={className}>{t(item.labelKey)}</a>
              : <Link key={item.href} href={target.href} className={className}>{t(item.labelKey)}</Link>;
          })}
          <LanguageSwitcher />
          {ticketsTarget.useFullNavigation ? (
            <a
              href={ticketsTarget.href}
              data-track="nav_purchase_tickets"
              className="px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-bold text-sm shadow-sm transition-transform hover:scale-105"
              style={{ backgroundColor: `hsl(${config.brand.colors.primary})`, color: `hsl(${config.brand.colors.primaryForeground})` }}
            >
              {t('nav.buyTickets')}
            </a>
          ) : (
            <Link
              href={ticketsTarget.href}
              data-track="nav_purchase_tickets"
              className="px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-bold text-sm shadow-sm transition-transform hover:scale-105"
              style={{ backgroundColor: `hsl(${config.brand.colors.primary})`, color: `hsl(${config.brand.colors.primaryForeground})` }}
            >
              {t('nav.buyTickets')}
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
