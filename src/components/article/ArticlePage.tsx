/**
 * ArticlePage.tsx — full editorial article layout.
 *
 * Renders:
 *  - Skip link
 *  - Breadcrumb nav
 *  - Hero <picture> (mobile + desktop <source> + fallback <img>)
 *  - Key-facts strip
 *  - FAQ jump nav (pill bar, shown when 4+ h2 sections)
 *  - ReactMarkdown body (h2 override → slugified id + scroll-mt-24)
 *  - <Faq> accordion
 *  - Sources section
 *  - Article footer (independence disclosure + dateModified)
 *  - PlanYourVisit cross-link cluster
 *  - StickyTicketCta bar
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

import { PageLayout } from '@/components/layout/PageLayout';
import { Faq } from './Faq';
import { PlanYourVisit } from './PlanYourVisit';
import { StickyTicketCta } from '@/components/StickyTicketCta';
import { SITE } from '@/config/site';
import type { Article } from '@/lib/article-types';
import { RelatedContent } from './RelatedContent';
import { articleLinkUrlTransform } from './article-link-url';

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Extract the h2 headings from Markdown for the jump nav. */
function extractH2Headings(md: string): string[] {
  const headings: string[] = [];
  for (const line of md.split('\n')) {
    const m = line.match(/^##\s+(.+)$/);
    if (m) headings.push(m[1].trim());
  }
  return headings;
}

// ── ReactMarkdown component overrides ─────────────────────────────────────────

const h2Component: Components['h2'] = ({ children }) => {
  const text =
    typeof children === 'string'
      ? children
      : Array.isArray(children)
        ? children.map((c) => (typeof c === 'string' ? c : '')).join('')
        : '';
  const id = slugify(text);
  return (
    <h2
      id={id}
      className="scroll-mt-24 font-serif text-2xl font-bold mt-12 mb-4 border-b border-foreground/20 pb-2"
    >
      {children}
    </h2>
  );
};

const markdownComponents: Components = {
  h2: h2Component,
  h3: ({ children }) => (
    <h3 className="font-serif text-xl font-semibold mt-8 mb-3">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="mb-5 text-base leading-relaxed text-foreground/85">{children}</p>
  ),
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => (
    <a href={href} className="underline underline-offset-2 hover:opacity-80">
      {children}
    </a>
  ),
  ul: ({ children }) => <ul className="list-disc pl-6 mb-5 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-6 mb-5 space-y-1">{children}</ol>,
  li: ({ children }) => <li className="text-base leading-relaxed text-foreground/85">{children}</li>,
};

// ── Component ─────────────────────────────────────────────────────────────────

type Props = {
  article: Article;
};

export function ArticlePage({ article }: Props) {
  const h2Headings = extractH2Headings(article.body);
  const showJumpNav = h2Headings.length >= 4;

  const sectionLinks = h2Headings.map((heading) => ({
    id: slugify(heading),
    label: heading,
  }));

  // Independence disclosure from SITE config
  const independenceNote = SITE.organization.independenceNote;

  return (
    <PageLayout>
      {/* Skip link */}
      <a
        href="#article-body"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow"
      >
        Skip to article
      </a>

      <article className="article mx-auto max-w-3xl px-6 pb-32 w-full">

        {/* Breadcrumb nav */}
        <nav aria-label="Breadcrumb" className="article__breadcrumb pt-6 pb-4">
          <ol className="flex flex-wrap items-center gap-1.5 text-sm text-foreground/50">
            {article.breadcrumbs.map((crumb, i) => (
              <li key={i} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden="true">/</span>}
                {crumb.path === null ? (
                  <span aria-current="page" className="text-foreground/80 font-medium">
                    {crumb.name}
                  </span>
                ) : (
                  <a href={crumb.path || '/'} className="hover:underline">
                    {crumb.name}
                  </a>
                )}
              </li>
            ))}
          </ol>
        </nav>

        {/* H1 */}
        <h1 className="article__h1 font-serif text-3xl md:text-4xl lg:text-5xl font-bold leading-tight mt-4 mb-4">
          {article.h1}
        </h1>

        {/* Lede */}
        <p className="article__lede text-lg text-foreground/70 leading-relaxed mb-6 border-b border-foreground/10 pb-6">
          {article.lede}
        </p>

        {/* Hero picture */}
        <div className="article__hero -mx-6 mb-8 overflow-hidden">
          <picture>
            <source
              media="(max-width: 1023px)"
              srcSet={`${article.hero.mobile} 1x, ${article.hero.mobile2x} 2x`}
              type="image/webp"
            />
            <source
              media="(min-width: 1024px)"
              srcSet={`${article.hero.desktop} 1x, ${article.hero.desktop2x} 2x`}
              type="image/webp"
            />
            <img
              src={article.hero.fallback}
              alt={article.hero.alt}
              width={article.hero.width}
              height={article.hero.height}
              fetchPriority="high"
              decoding="async"
              className="w-full object-cover"
              style={{ objectPosition: article.hero.focal }}
            />
          </picture>
        </div>

        {/* Key-facts strip */}
        {article.keyFacts?.length > 0 && (
          <ul className="article__key-facts grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10 p-5 bg-muted/30 rounded-xl">
            {article.keyFacts.map((fact, i) => (
              <li key={i} className="article__key-fact text-center">
                <span className="block font-serif text-lg font-bold">{fact.name}</span>
                <span className="block text-xs text-foreground/60 mt-0.5 leading-snug">
                  {fact.description}
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* FAQ jump nav — shown when 4+ sections */}
        {showJumpNav && (
          <nav
            aria-label="Jump to section"
            className="article__jump-nav overflow-x-auto whitespace-nowrap pb-2 mb-8"
          >
            <div className="inline-flex gap-2 px-1">
              {sectionLinks.map(({ id, label }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className="inline-block border border-foreground/30 rounded-full px-4 py-1.5 text-sm hover:bg-foreground/10 transition-colors"
                >
                  {label}
                </a>
              ))}
            </div>
          </nav>
        )}

        {/* Article body */}
        <div id="article-body" className="article__body prose prose-neutral max-w-none">
          <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}
            urlTransform={articleLinkUrlTransform(article.internalLinks)}>
            {article.body}
          </ReactMarkdown>
        </div>

        {/* FAQ accordion */}
        {article.faq?.length ? (
          <Faq heading={article.faqHeading} items={article.faq} />
        ) : null}

        <RelatedContent links={article.relatedContent} />

        {/* Sources */}
        {article.sources?.length ? (
          <section className="article__sources mt-10 border-t border-foreground/20 pt-6">
            <h2 className="text-sm font-bold uppercase tracking-widest text-foreground/50 mb-3">
              Sources
            </h2>
            <ul className="space-y-1">
              {article.sources.map((src, i) => (
                <li key={i} className="text-sm">
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground/60 hover:text-foreground underline underline-offset-2"
                  >
                    {src.title}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Article footer */}
        <footer className="article__footer mt-10 border-t border-foreground/20 pt-6 text-xs text-foreground/40 space-y-1">
          <p>{independenceNote}</p>
          <p>
            Last updated:{' '}
            <time dateTime={article.dateModified}>
              {new Date(article.dateModified).toLocaleDateString(article.locale, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
          </p>
        </footer>

        {/* Cross-link cluster */}
        <PlanYourVisit
          currentSlug={article.slug}
          articleCanonicalPath={article.canonicalPath}
        />

      </article>

      {/* Sticky ticket CTA */}
      <StickyTicketCta />
    </PageLayout>
  );
}
