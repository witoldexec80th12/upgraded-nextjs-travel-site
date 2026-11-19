import type { ArticleRelatedLink } from '@/lib/article-types';

export function RelatedContent({ links }: { links?: ArticleRelatedLink[] }) {
  if (!links?.length) return null;
  return (
    <section className="mt-10 border-t border-foreground/20 pt-6" aria-labelledby="related-content-heading">
      <h2 id="related-content-heading" className="mb-3 text-sm font-bold uppercase tracking-widest">
        Related content
      </h2>
      <ul className="space-y-2">
        {links.map(({ href, title, locale }) => (
          <li key={href}>
            <a href={href} lang={locale} hrefLang={locale} className="underline underline-offset-2">
              {title}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
