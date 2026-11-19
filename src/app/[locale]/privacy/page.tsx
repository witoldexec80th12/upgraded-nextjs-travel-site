import { InformationPage } from '@/components/layout/InformationPage';
import { getPagePresentation } from '@/lib/page-metadata';
type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props) {
  return getPagePresentation(`/${(await params).locale}/privacy`)?.metadata ?? {};
}
export default async function Page({ params }: Props) {
  return <InformationPage locale={(await params).locale} kind="privacy" />;
}
