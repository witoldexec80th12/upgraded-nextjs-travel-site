import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getPackage, getPackages } from '@/lib/packages';
import { PagePresentation } from '@/components/seo/PagePresentation';
import { getPagePresentation } from '@/lib/page-metadata';
import BookingFlow from '@/components/booking/BookingFlow';

type Props = { params: Promise<{ locale: string; package: string }> };
export const dynamicParams = false;
export function generateStaticParams({ params }: { params: { locale: string } }) {
  return getPackages(params.locale).map(({ slug }) => ({ package: slug }));
}
export async function generateMetadata({ params }: Props) {
  const { locale, package: slug } = await params;
  return getPagePresentation(`/${locale}/booking/${slug}`)?.metadata ?? {};
}
export default async function BookingPage({ params }: Props) {
  const { locale, package: slug } = await params;
  const item = getPackage(slug, locale);
  if (!item) notFound();
  return <PagePresentation path={`/${locale}/booking/${slug}`}>
    <Suspense fallback={<p role="status">Loading booking details…</p>}><BookingFlow item={item} /></Suspense>
  </PagePresentation>;
}
