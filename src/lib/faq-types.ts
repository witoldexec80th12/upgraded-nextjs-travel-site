/**
 * FAQ Enrichment types — the rich data model for content/faq/*.md files.
 *
 * Three outputs from one source file:
 *   1. /faq page     — full grouped layout with CTA placements
 *   2. Homepage block — priority:high items only, flat (no group headers)
 *   3. FAQPage JSON-LD — schema:true items with links stripped from answers
 */

export type FaqItemLink = {
  /** Internal path or external URL */
  href: string;
  /** Visible anchor text */
  anchor: string;
};

export type FaqItem = {
  /** Question text — shown verbatim on page and in JSON-LD */
  q: string;
  /**
   * Answer text. May contain inline Markdown links ([text](href)).
   * Links render in the accordion but are stripped for FAQPage JSON-LD
   * (Google disallows links in FAQ schema answers).
   */
  a: string;
  /**
   * Include this item in FAQPage JSON-LD.
   * Set to false only for items whose answer contains unverified claims
   * or ticket prices that change frequently.
   */
  schema: boolean;
  priority: 'high' | 'medium' | 'low';
  /** Editorial: links that should appear in this answer — used for content audits. */
  links?: FaqItemLink[];
  /** Editorial: intent label for analytics/CRO analysis — not rendered. */
  intent?: string;
};

export type FaqGroup = {
  /** Rendered as an H2 heading on the page */
  name: string;
  /**
   * Stable identifier. Used to target CTA placement:
   * set ctas.primary.placement = "after-<id>" to insert a CTA after this group.
   */
  id: string;
  priority: 'high' | 'medium' | 'low';
  items: FaqItem[];
};

export type FaqCta = {
  label: string;
  href: string;
  /**
   * Where to insert this CTA on the page.
   * "after-<group-id>" → after the group with that id.
   * "end"              → after all groups.
   */
  placement?: string;
};

export type FaqSource = {
  label: string;
  url: string;
  /** "official" | "authority-database" | "press" | etc. */
  type?: string;
  /** Which specific claims this source supports (editorial, not rendered). */
  supports?: string[];
};

export type FaqEnrichment = {
  slug: string;
  locale: string;

  seo: {
    /** Full page title for <title> and og:title (~60 chars) */
    title: string;
    /** Meta description (~155 chars) */
    metaDescription: string;
    /** Shorter on-page H1. Falls back to seo.title if omitted. */
    ogTitle?: string;
    /** Intro paragraph shown above the FAQ groups. Falls back to seo.metaDescription. */
    ogDescription?: string;
    noindex?: boolean;
  };

  dates: {
    published: string;
    modified: string;
    lastChecked?: string;
    /** ISO date — when to review/refresh this FAQ */
    nextReviewDue?: string;
    /** "high" | "medium" | "low" — how frequently the content changes */
    freshnessLevel?: string;
  };

  breadcrumbs: Array<{ name: string; href: string }>;

  ctas?: {
    primary?: FaqCta;
    secondary?: FaqCta;
  };

  faqGroups: FaqGroup[];

  sources?: FaqSource[];
};
