import { notFound } from 'next/navigation';
import { getPublicPaths } from '@/lib/site-pages';
import { getPagePresentation } from '@/lib/page-metadata';
import { PagePresentation } from '@/components/seo/PagePresentation';
import ArticlePage from '@/views/ArticlePage';

type Props = { params: Promise<{ locale: string; slug: string }> };
export const dynamicParams = false;
export function generateStaticParams({ params }: { params: { locale: string } }) {
  return getPublicPaths().filter((path) => path.startsWith(`/${params.locale}/guides/`))
    .map((path) => ({ slug: path.split('/').at(-1)! }));
}
export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  return getPagePresentation(`/${locale}/guides/${slug}`)?.metadata ?? {};
}
export default async function GuidePage({ params }: Props) {
  const { locale, slug } = await params;
  const path = `/${locale}/guides/${slug}`;
  const presentation = getPagePresentation(path);
  if (!presentation) notFound();
  const article = presentation.page.article;
  return <PagePresentation path={path}>
    {article && <>
      <link rel="preload" as="image" imageSrcSet={`${article.hero.mobile} 1x, ${article.hero.mobile2x} 2x`} media="(max-width:1023px)" />
      <link rel="preload" as="image" imageSrcSet={`${article.hero.desktop} 1x, ${article.hero.desktop2x} 2x`} media="(min-width:1024px)" />
    </>}
    <ArticlePage path={article ? path : `/article/${slug}`} locale={locale} />
  </PagePresentation>;
}
