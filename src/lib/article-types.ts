/**
 * Article — the rich data type for editorial articles in src/data/articles/.
 *
 * This type is the SEO/CRO contract for the article page: every field maps
 * directly to a head tag, JSON-LD node, or on-page content element.
 * Do not add fields here without also wiring them into:
 *   - src/lib/article-schema.ts  (JSON-LD)
 *   - src/components/article/ArticlePage.tsx  (on-page rendering)
 *   - scripts/prerender.ts       (SSG head injection)
 */

export type ArticleHero = {
  /** Smallest viewport WebP, e.g. "/articles/queen-marie/hero-480.webp" */
  mobile: string;
  /** 2× DPR variant for mobile, e.g. "/articles/queen-marie/hero-960.webp" */
  mobile2x: string;
  /** Largest viewport WebP, e.g. "/articles/queen-marie/hero-1440.webp" */
  desktop: string;
  /** 2× DPR variant for desktop */
  desktop2x: string;
  /** JPEG fallback for browsers without WebP support */
  fallback?: string;
  /**
   * Open Graph / Twitter card image.
   * Recommended dimensions: 1200×630.
   */
  og?: string;
  /** Screen-reader alt text — describe the image content, not "hero image". */
  alt: string;
  /** Intrinsic width of the desktop src, in pixels (used in ImageObject schema). */
  width: number;
  /** Intrinsic height of the desktop src, in pixels. */
  height: number;
  /**
   * CSS object-position for focal-point cropping, e.g. "50% 30%".
   * Defaults to "50% 50%" (centered) if omitted.
   */
  focal?: string;
  /** Credit / copyright notice shown in schema */
  creditText?: string;
};

export type ArticleKeyFact = {
  name: string;
  description: string;
};

export type ArticleFaqItem = {
  q: string;
  a: string;
};

export type ArticleSource = {
  title: string;
  url: string;
};

export type ArticleSchemaEntity = {
  type: string;
  name: string;
  url?: string;
  sameAs?: string[];
  latitude?: number;
  longitude?: number;
};

export type ArticleBreadcrumb = {
  name: string;
  /**
   * Absolute path with leading slash, or "/" for home.
   * null = current page (no link rendered).
   */
  path: string | null;
};

export type ArticleRelatedLink = { href: string; title: string; locale: string };

export type Article = {
  /**
   * Localized URL slug, e.g. "castillo-de-bran-la-reina-maria".
   */
  slug: string;
  /** ISO 639-1 language code, e.g. "en" or "es". */
  locale: string;
  /** Open Graph language-region code, e.g. "es_ES". */
  ogLocale: string;
  /** English category segment used in the URL, e.g. "history". */
  categoryPath: string;
  /** This locale's route, e.g. "/es/guides/castillo-de-bran-la-reina-maria". */
  href: string;
  /** Own localized route, or the English original for an untranslated fallback. */
  canonicalPath: string;
  /** Stable English original, independent of this page's canonical. */
  englishPath: string;
  /** Actual content language; en on explicitly declared English fallbacks. */
  contentLocale: string;
  noindex: boolean;
  /** Published, indexable translations only. */
  alternateRoutes: Array<{ locale: string; path: string; ogLocale: string }>;

  // ── Head tags ────────────────────────────────────────────────────────────
  /** Used in <title> and og:title. ~60 chars max. */
  title: string;
  /** Meta description. ~155 chars — no truncation on SERP cards. */
  metaDescription: string;

  // ── Above-the-fold ───────────────────────────────────────────────────────
  /** H1 text. Can differ from title (title is for SERP; h1 is for readers). */
  h1: string;
  /**
   * Standfirst lede shown directly below the H1.
   * 1-2 sentences. Complete standalone paragraph.
   */
  lede: string;

  // ── Dates ────────────────────────────────────────────────────────────────
  /** ISO 8601 date, e.g. "2026-07-28". */
  datePublished: string;
  /** ISO 8601 date. Must be ≥ datePublished. Update when content changes. */
  dateModified: string;

  // ── Media ────────────────────────────────────────────────────────────────
  hero: ArticleHero;

  // ── Navigation ───────────────────────────────────────────────────────────
  /** Breadcrumb trail. Last entry has path: null (current page). */
  breadcrumbs: ArticleBreadcrumb[];

  // ── Content ──────────────────────────────────────────────────────────────
  /**
   * Key facts bar — 3-6 scannable facts displayed above the body.
   */
  keyFacts: ArticleKeyFact[];
  /**
   * Article body in Markdown (react-markdown + remark-gfm).
   * Use INTERNAL-LINK:<stable English article ID> for localized article links.
   */
  body: string;
  /** Markdown token destinations resolved at compilation. */
  internalLinks?: Record<string, ArticleRelatedLink>;
  /** Resolved, deduplicated article and tour relationships in editorial order. */
  relatedContent?: ArticleRelatedLink[];

  // ── FAQ section (optional) ───────────────────────────────────────────────
  /** Custom heading above the FAQ block. */
  faqHeading?: string;
  /**
   * FAQ items. When present, a FAQPage JSON-LD node is emitted.
   * Each answer must be a complete standalone sentence.
   */
  faq?: ArticleFaqItem[];

  // ── Sources (optional) ───────────────────────────────────────────────────
  /** Attribution links shown at the foot of the article. */
  sources?: ArticleSource[];

  // ── Optional author ───────────────────────────────────────────────────────
  /** Named author Person, if different from the Organization publisher. */
  author?: { name: string; url?: string };
  /** Optional YAML-configured subject; defaults to the site's configured attraction. */
  schemaEntity?: ArticleSchemaEntity;
};
