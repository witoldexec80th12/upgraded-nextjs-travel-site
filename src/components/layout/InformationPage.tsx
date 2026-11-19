import { PagePresentation } from '@/components/seo/PagePresentation';
import ContentPage from '@/views/ContentPage';
import LegalPage from '@/views/LegalPage';
import FaqPage from '@/views/FaqPage';

export type InformationKind = 'faq' | 'activities' | 'contact' | 'terms' | 'privacy' | 'cookies';
export function InformationPage({ locale, kind }: { locale: string; kind: InformationKind }) {
  return <PagePresentation path={`/${locale}/${kind}`}>
    {kind === 'faq' ? <FaqPage locale={locale} /> :
      kind === 'activities' || kind === 'contact' ? <ContentPage type={kind} locale={locale} /> :
        <LegalPage type={kind} />}
  </PagePresentation>;
}
