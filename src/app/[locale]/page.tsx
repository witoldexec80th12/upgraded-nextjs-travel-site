import Home from '@/views/Home';
import { PagePresentation } from '@/components/seo/PagePresentation';
import { getPagePresentation } from '@/lib/page-metadata';

type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props) {
  return getPagePresentation(`/${(await params).locale}`)?.metadata ?? {};
}
export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  return <PagePresentation path={`/${locale}`}><Home /></PagePresentation>;
}
