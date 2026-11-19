import { notFound } from 'next/navigation';
import { getPackages, getPackage } from '@/lib/packages';
import { getPagePresentation } from '@/lib/page-metadata';
import { PagePresentation } from '@/components/seo/PagePresentation';
import { PackageDetails } from '@/components/packages/PackageDetails';

type Props = { params: Promise<{ locale: string; slug: string }> };
export const dynamicParams = false;
export function generateStaticParams({ params }: { params: { locale: string } }) {
  return getPackages(params.locale).map(({ slug }) => ({ slug }));
}
export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  return getPagePresentation(`/${locale}/tours/${slug}`)?.metadata ?? {};
}
export default async function TourPage({ params }: Props) {
  const { locale, slug } = await params;
  const item = getPackage(slug, locale);
  if (!item) notFound();
  return <PagePresentation path={`/${locale}/tours/${slug}`}><PackageDetails item={item} /></PagePresentation>;
}
