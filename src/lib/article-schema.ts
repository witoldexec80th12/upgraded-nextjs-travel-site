/**
 * buildArticleJsonLd — editorial JSON-LD schema for article pages.
 *
 * Returns an array of plain objects (one per schema node).
 * Each is rendered as a separate <script type="application/ld+json"> tag —
 * do NOT wrap them in an @graph. Use jsonLdNodes in SeoHeadOpts.
 *
 * Node order:
 *  1. Article          — core editorial node
 *  2. FAQPage          — if article.faq is non-empty
 *  3. ImageObject      — hero image with dimensions
 *  4. BreadcrumbList
 *  5. WebPage          — links Article to WebSite
 *  6. TouristAttraction — authority reference
 *  7. Organization
 *  8. WebSite
 *  9. Person/Author    — if article.author is present
 */

import { SITE } from '../config/site';
import type { Article } from './article-types';
import type { EventConfig } from '../content/event.en';

function orgId()        { return `${SITE.origin}/#organization`; }
function websiteId()    { return `${SITE.origin}/#website`; }
function attractionId() { return `${SITE.origin}/#attraction`; }

/** Absolute URL for the article page. */
function articleUrl(article: Article): string {
  return `${SITE.origin}${article.canonicalPath}`;
}

export function buildArticleJsonLd(article: Article, _config: EventConfig): object[] {
  const url = articleUrl(article);
  const contentLocale = article.contentLocale;
  const heroUrl = `${SITE.origin}${article.hero.og ?? article.hero.desktop}`;
  const configuredSubject = article.schemaEntity;
  const subjectId = configuredSubject
    ? `${(configuredSubject.url ?? url).replace(/\/+$/, '')}#attraction`
    : attractionId();

  // ── 1. Article ─────────────────────────────────────────────────────────────
  const articleNode: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${url}#article`,
    url,
    headline: article.h1,
    description: article.metaDescription,
    image: { '@id': `${url}#hero` },
    inLanguage: contentLocale,
    datePublished: article.datePublished,
    dateModified: article.dateModified,
    author: article.author
      ? { '@type': 'Person', '@id': `${url}#author`, name: article.author.name }
      : { '@id': orgId() },
    publisher: { '@id': orgId() },
    mainEntityOfPage: url,
    about: { '@id': subjectId },
  };

  // ── 2. FAQPage (conditional) ───────────────────────────────────────────────
  const faqNode: Record<string, unknown> | null =
    article.faq?.length
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          '@id': `${url}#faq`,
           inLanguage: contentLocale,
          speakable: {
            '@type': 'SpeakableSpecification',
            cssSelector: ['.faq-item__q', '.faq-item__a'],
          },
          mainEntity: article.faq.map((qa) => ({
            '@type': 'Question',
            name: qa.q,
           acceptedAnswer: { '@type': 'Answer', text: qa.a, inLanguage: contentLocale },
          })),
        }
      : null;

  // ── 3. ImageObject ─────────────────────────────────────────────────────────
  const imageObjectNode: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'ImageObject',
    '@id': `${url}#hero`,
    url: heroUrl,
    contentUrl: heroUrl,
    width: article.hero.width,
    height: article.hero.height,
    caption: article.hero.alt,
    representativeOfPage: true,
    inLanguage: contentLocale,
    copyrightHolder: { '@id': orgId() },
    ...(article.hero.creditText ? { creditText: article.hero.creditText } : {}),
    license: `${SITE.origin}/terms`,
  };

  // ── 4. BreadcrumbList ──────────────────────────────────────────────────────
  const breadcrumbNode: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: article.breadcrumbs.map((b, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: b.name,
      item: b.path === null
        ? url
        : b.path === '' || b.path === '/'
          ? `${SITE.origin}/`
          : `${SITE.origin}${b.path}`,
    })),
  };

  // ── 5. WebPage ─────────────────────────────────────────────────────────────
  const webPageNode: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: article.title,
    description: article.metaDescription,
    inLanguage: contentLocale,
    isPartOf: { '@id': websiteId() },
    about: { '@id': subjectId },
    primaryImageOfPage: heroUrl,
    dateModified: article.dateModified,
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: ['h1', '.article__lede', '.faq-item__q', '.faq-item__a'],
    },
  };

  // ── 6. TouristAttraction (simplified) ─────────────────────────────────────
  const attractionNode: Record<string, unknown> = configuredSubject
    ? {
        '@context': 'https://schema.org',
        '@type': configuredSubject.type,
        '@id': subjectId,
        name: configuredSubject.name,
        ...(configuredSubject.url ? { url: configuredSubject.url } : {}),
        ...(configuredSubject.sameAs?.length ? { sameAs: configuredSubject.sameAs } : {}),
        ...(configuredSubject.latitude !== undefined && configuredSubject.longitude !== undefined
          ? {
              geo: {
                '@type': 'GeoCoordinates',
                latitude: configuredSubject.latitude,
                longitude: configuredSubject.longitude,
              },
            }
          : {}),
      }
    : {
        '@context': 'https://schema.org',
        '@type': 'TouristAttraction',
        '@id': attractionId(),
        name: SITE.attraction.name,
        alternateName: SITE.attraction.alternateName,
        geo: {
          '@type': 'GeoCoordinates',
          latitude: SITE.attraction.latitude,
          longitude: SITE.attraction.longitude,
        },
        sameAs: SITE.attraction.sameAs,
        isAccessibleForFree: false,
        publicAccess: true,
      };

  // ── 7. Organization ────────────────────────────────────────────────────────
  const organizationNode: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': orgId(),
    name: SITE.organization.name,
    url: `${SITE.origin}/`,
    email: SITE.organization.email,
    logo: {
      '@type': 'ImageObject',
      url: `${SITE.origin}${SITE.organization.logoPath}`,
    },
    description: SITE.organization.independenceNote,
    knowsAbout: [{ '@id': subjectId }],
  };

  // ── 8. WebSite ─────────────────────────────────────────────────────────────
  const websiteNode: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': websiteId(),
    url: `${SITE.origin}/`,
    name: SITE.brandName,
    publisher: { '@id': orgId() },
    inLanguage: contentLocale,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE.origin}/?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  // ── 9. Person/Author (conditional) ────────────────────────────────────────
  const authorNode: Record<string, unknown> | null =
    article.author
      ? {
          '@context': 'https://schema.org',
          '@type': 'Person',
          '@id': `${url}#author`,
          name: article.author.name,
          ...(article.author.url ? { url: article.author.url } : {}),
        }
      : null;

  return [
    articleNode,
    faqNode,
    imageObjectNode,
    breadcrumbNode,
    webPageNode,
    attractionNode,
    organizationNode,
    websiteNode,
    authorNode,
  ].filter((n): n is Record<string, unknown> => n !== null);
}
