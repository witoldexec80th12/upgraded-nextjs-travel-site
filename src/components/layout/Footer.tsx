'use client';

import { Link } from '@/lib/navigation';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/i18n/I18nContext';
import { getEventConfig } from '@/content';
import { SITE } from '@/config/site';
import { REFUND_POLICY } from '@/lib/ticket-schema';
import { getSiteNavigationTarget } from '@/lib/localized-navigation';

export function Footer() {
  const { locale, t } = useI18n();
  const config = getEventConfig(locale);
  const year = new Date().getFullYear();
  const pathname = usePathname();
  const renderSiteLink = (href: string, label: string) => {
    const target = getSiteNavigationTarget(pathname, href, locale);
    return target.useFullNavigation ? (
      <a key={href} href={target.href} className="hover:opacity-75 transition-opacity">{label}</a>
    ) : (
      <Link key={href} href={target.href} className="hover:opacity-75 transition-opacity">{label}</Link>
    );
  };

  return (
    <footer className="border-t py-16 mt-auto" style={{ backgroundColor: `hsl(${config.brand.colors.footerBg})`, color: `hsl(${config.brand.colors.footerText})` }}>
      <div className="container mx-auto px-6 flex flex-col gap-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="space-y-4 max-w-xl">
            <h3 className="font-serif text-2xl font-bold">{config.brand.name}</h3>
            {config.contact.description.map((desc, i) => (
              <p key={i} className="text-sm opacity-80 leading-relaxed">{desc}</p>
            ))}
            <p className="text-sm opacity-80 leading-relaxed">
              <strong>Contact:</strong> <a href={`mailto:${config.contact.email}`} className="hover:underline">{config.contact.email}</a>
            </p>
          </div>
          <div className="flex flex-col md:items-end justify-start gap-4 text-sm font-medium">
            {SITE.navigation.footer.map((item) => renderSiteLink(item.href, t(item.labelKey)))}
          </div>
        </div>
        <div className="pt-8 border-t border-white/20 space-y-4 text-xs opacity-60">
          <p className="leading-relaxed">{SITE.organization.independenceNote}</p>
          <p className="leading-relaxed"><strong>Booking policy:</strong> {REFUND_POLICY}</p>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p>{t('footer.copyright', { year }).replace('{year}', String(year))}</p>
            <p>{config.legalEntity.companyName}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
