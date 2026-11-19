import { Suspense } from 'react';
import { PagePresentation } from '@/components/seo/PagePresentation';
import { getPagePresentation } from '@/lib/page-metadata';
import BookingConfirmation from '@/components/booking/BookingConfirmation';
type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props) {
  return getPagePresentation(`/${(await params).locale}/success`)?.metadata ?? {};
}
export default async function Page({ params }: Props) {
  return <PagePresentation path={`/${(await params).locale}/success`}>
    <Suspense fallback={<p role="status">Loading confirmation…</p>}><BookingConfirmation /></Suspense>
  </PagePresentation>;
}
