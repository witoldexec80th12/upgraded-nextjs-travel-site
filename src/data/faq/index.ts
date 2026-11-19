// @generated — do not edit. Source: src/content/<locale>/faq.md
// Run `npm run faq` to regenerate.
import type { FaqEnrichment, FaqItem } from '@/lib/faq-types';

import _faq_en from './en';

const FAQ_MAP: Record<string, FaqEnrichment> = {
  "en": _faq_en,
};

/**
 * Returns the FAQ enrichment for a locale, falling back to English.
 * Returns null only if no FAQ file exists at all.
 */
export function getFaqData(locale: string): FaqEnrichment | null {
  return FAQ_MAP[locale] ?? FAQ_MAP['en'] ?? null;
}

/**
 * Returns priority:high FAQ items across all groups, flattened, for use in
 * the homepage compact FAQ block. Max 6 items.
 */
export function getHomepageFaqItems(locale: string, max = 6): FaqItem[] {
  const data = getFaqData(locale);
  if (!data) return [];
  return data.faqGroups
    .flatMap((g) => g.items)
    .filter((i) => i.priority === 'high')
    .slice(0, max);
}

/**
 * Returns items marked schema:true, with Markdown links stripped from answers,
 * ready for the shared server-rendered FAQ structured data.
 */
export function getFaqSchemaItems(locale: string): Array<{ q: string; a: string }> {
  const data = getFaqData(locale);
  if (!data) return [];
  return data.faqGroups
    .flatMap((g) => g.items)
    .filter((i) => i.schema)
    .map((i) => ({ q: i.q, a: stripLinks(i.a) }));
}

/** Strip Markdown inline links and formatting — answers must be plain text in JSON-LD. */
function stripLinks(md: string): string {
  return md
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
