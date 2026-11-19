// Pure, framework-agnostic SEO/GEO helpers. Deliberately dependency-free
// (no DOM, no React) so they can run in Next.js metadata and the sitemap
// generator. All public helpers accept EventConfig so the same logic works
// across locales without a global singleton.
import { eventContentLocales } from '@/content';
import type { EventConfig } from '../content/event.en';
import { SITE } from '../config/site';

export function getSiteUrl(config: EventConfig): string {
  // SITE.origin is the single domain setting for metadata, schema and sitemap.
  return SITE.origin.replace(/\/$/, '');
}

export function localePrefix(locale: string): string {
  return `/${locale}`;
}

const OG_LOCALE_BY_LANGUAGE: Record<string, string> = {
  en: 'en_US', es: 'es_ES', fr: 'fr_FR', de: 'de_DE', it: 'it_IT',
  pl: 'pl_PL', pt: 'pt_PT', nl: 'nl_NL', el: 'el_GR', ru: 'ru_RU',
  ko: 'ko_KR', ja: 'ja_JP', zh: 'zh_CN', ro: 'ro_RO',
};

export function openGraphLocale(locale: string): string {
  return OG_LOCALE_BY_LANGUAGE[locale] ?? `${locale}_${locale.toUpperCase()}`;
}

/** Builds an absolute, self-referencing URL for a given locale + path.
 *  Never points a non-English locale at the English URL — that is the
 *  canonical mistake that suppresses non-English indexing. */
export function absoluteUrl(config: EventConfig, locale: string, path: string): string {
  const site = getSiteUrl(config);
  const cleanPath = path === '/' ? '' : path;
  const full = `${site}${localePrefix(locale)}${cleanPath}`;
  return full || site;
}

/** Resolves an asset path (e.g. `/hero.jpg`) to an absolute URL.
 *  Required for OG/Twitter images — relative paths break link previews. */
export function absoluteAsset(config: EventConfig, assetPath: string): string {
  if (/^https?:\/\//.test(assetPath)) return assetPath;
  const site = getSiteUrl(config);
  return `${site}${assetPath.startsWith('/') ? '' : '/'}${assetPath}`;
}

export type HreflangLink = { hreflang: string; href: string };

/** Full reciprocal hreflang set for a path: every locale + x-default pointing
 *  at the English URL. */
export function getHreflangLinks(config: EventConfig, path: string): HreflangLink[] {
  const links = eventContentLocales.map((locale) => ({
    hreflang: locale,
    href: absoluteUrl(config, locale, path),
  }));
  links.push({ hreflang: 'x-default', href: absoluteUrl(config, 'en', path) });
  return links;
}

export type Breadcrumb = { name: string; path: string };
export type FaqEntry = { q: string; a: string };

/**
 * Builds the JSON-LD @graph for a page.
 *
 * Always present:
 * - Organization — with @id #organization, independence note, logo
 * - WebSite — with @id #website, SearchAction (sitelinks searchbox)
 * - TouristAttraction — with @id #attraction, alternateName, sameAs authority
 *   links, isAccessibleForFree: false, geo, openingHours
 *
 * Conditionally present:
 * - BreadcrumbList — when opts.breadcrumbs is provided
 * - FAQPage — when opts.faqItems is provided (AI answer engines read this)
 */
export function buildJsonLdGraph(
  config: EventConfig,
  locale: string,
  opts: { breadcrumbs?: Breadcrumb[]; faqItems?: FaqEntry[] } = {},
) {
  const site = getSiteUrl(config);
  const seo = config.seo;

  const orgId = `${site}/#organization`;
  const websiteId = `${site}/#website`;
  const attractionId = `${site}/#attraction`;

  // ── Organization ────────────────────────────────────────────────────────
  const organization: Record<string, unknown> = {
    '@type': 'Organization',
    '@id': orgId,
    name: SITE.organization.name,
    url: `${site}/`,
    email: SITE.organization.email,
    logo: {
      '@type': 'ImageObject',
      url: `${site}${SITE.organization.logoPath}`,
    },
    description: SITE.organization.independenceNote,
    knowsAbout: [{ '@id': attractionId }],
  };

  // ── WebSite with SearchAction ────────────────────────────────────────────
  const website: Record<string, unknown> = {
    '@type': 'WebSite',
    '@id': websiteId,
    url: site,
    name: config.brand.name,
    inLanguage: locale,
    publisher: { '@id': orgId },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${site}/?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  // ── TouristAttraction ────────────────────────────────────────────────────
  const attraction: Record<string, unknown> = {
    '@type': seo?.businessType || 'TouristAttraction',
    '@id': attractionId,
    name: config.brand.name,
    url: site,
    image: absoluteAsset(config, config.hero.heroImage),
    address: {
      '@type': 'PostalAddress',
      streetAddress: config.location.address,
    },
    telephone: config.contact.phone,
    email: config.contact.email,
    isAccessibleForFree: false,
    publicAccess: true,
  };

  // alternateName — from SITE config (venue-specific alternate names)
  if (SITE.attraction.alternateName.length) {
    attraction.alternateName = SITE.attraction.alternateName;
  }

  // geo coordinates
  const lat = seo?.geo?.latitude ?? SITE.attraction.latitude;
  const lng = seo?.geo?.longitude ?? SITE.attraction.longitude;
  if (lat && lng) {
    attraction.geo = {
      '@type': 'GeoCoordinates',
      latitude: lat,
      longitude: lng,
    };
  }

  // openingHours
  if (seo?.openingHours?.length) {
    attraction.openingHoursSpecification = seo.openingHours.map((spec) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: spec.dayOfWeek,
      opens: spec.opens,
      closes: spec.closes,
    }));
  }

  // sameAs — merge social links from EventConfig + authority links from SITE
  const socialLinks = Object.values(seo?.social || {}).filter(Boolean) as string[];
  const authorityLinks = SITE.attraction.sameAs;
  const allSameAs = [...new Set([...socialLinks, ...authorityLinks])];
  if (allSameAs.length) {
    attraction.sameAs = allSameAs;
  }

  const graph: Record<string, unknown>[] = [organization, website, attraction];

  // ── BreadcrumbList ───────────────────────────────────────────────────────
  if (opts.breadcrumbs?.length) {
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': `${site}/#breadcrumbs`,
      itemListElement: opts.breadcrumbs.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: item.name,
        item: absoluteUrl(config, locale, item.path),
      })),
    });
  }

  // ── FAQPage ──────────────────────────────────────────────────────────────
  // AI answer engines (ChatGPT/Perplexity/Gemini) read this structured data
  // directly — answers must be complete, standalone sentences, not
  // fragments that only make sense next to the rendered question.
  if (opts.faqItems?.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${site}/#faq`,
      mainEntity: opts.faqItems.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    });
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}

type MetaDescriptionKey = keyof NonNullable<EventConfig['seo']['metaDescriptions']>;

/** Meta description for a page: explicit config value first, then the
 *  caller's on-page-copy fallback. */
export function getMetaDescription(
  config: EventConfig,
  key: MetaDescriptionKey,
  fallback: string,
): string {
  return config.seo?.metaDescriptions?.[key] || fallback;
}
