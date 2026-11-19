'use client';
import { Link } from '@/lib/navigation';
import { useI18n } from '@/i18n/I18nContext';

export function PackageBookingLink({ slug, ticketId }: { slug: string; ticketId: string }) {
  const { t } = useI18n();
  return <Link href={`/booking/${slug}?${ticketId}_adults=1`} className="inline-block bg-primary text-primary-foreground rounded-lg px-5 py-3 font-bold">
    {t('nav.buyTickets')}
  </Link>;
}
