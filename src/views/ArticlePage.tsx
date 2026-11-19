import { notFound } from 'next/navigation';
import { getArticleByPath } from '@/data/articles';
import { ArticlePage as ArticleLayout } from '@/components/article/ArticlePage';
import { getEventConfig } from '@/content';
import { PageLayout } from '@/components/layout/PageLayout';

/** Article Markdown stays on the server; only booking controls hydrate. */
export default function ArticlePage({ path, locale = 'en' }: { path: string; locale?: string }) {
  const article = getArticleByPath(path);
  if (article) return <ArticleLayout article={article} />;
  const legacy = getEventConfig(locale).discoverArticles.find((item) => path === `/article/${item.slug}`);
  if (!legacy) notFound();
  return <PageLayout>
    <article className="max-w-3xl mx-auto px-6 py-20 w-full">
      <h1 className="font-serif text-4xl font-bold mb-8">{legacy.title}</h1>
      <p className="text-lg mb-8">{legacy.excerpt}</p>
      {legacy.body.map((paragraph, index) => <p key={index} className="mb-5 leading-relaxed">{paragraph}</p>)}
    </article>
  </PageLayout>;
}
