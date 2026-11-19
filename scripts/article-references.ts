import type { ArticleRelatedLink } from '../src/lib/article-types';

export const referenceIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const articleReferencePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?$/;
export const relatedFields = ['relatedGuides', 'relatedArticles', 'relatedTours'] as const;
type RelatedField = typeof relatedFields[number];

export type ArticleReferenceEntry = {
  id: string;
  category: string;
  locale: string;
  contentLocale: string;
  href: string;
  title: string;
};

export type ArticleReferenceResolver = (id: string, locale: string) => ArticleRelatedLink | undefined;

/** Build from source articles, never from potentially stale generated output. */
export function createArticleReferenceResolver(entries: ArticleReferenceEntry[]): ArticleReferenceResolver {
  const groups = new Map<string, ArticleReferenceEntry[]>();
  const aliases = new Map<string, Set<string>>();
  for (const entry of entries) {
    const key = `${entry.category}/${entry.id}`;
    const variants = groups.get(key) ?? [];
    variants.push(entry);
    groups.set(key, variants);
    const keys = aliases.get(entry.id) ?? new Set<string>();
    keys.add(key);
    aliases.set(entry.id, keys);
  }
  return (id, locale) => {
    const keys = id.includes('/') ? [id] : [...(aliases.get(id) ?? [])];
    if (keys.length !== 1) return undefined;
    const variants = groups.get(keys[0]);
    const target = variants?.find((entry) => entry.locale === locale && entry.contentLocale === locale)
      ?? variants?.find((entry) => entry.locale === 'en');
    return target && { href: target.href, title: target.title, locale: target.locale };
  };
}

export function resolveRelatedContent(
  fields: Partial<Record<RelatedField, string[]>>,
  source: { href: string; locale: string },
  resolveArticle: ArticleReferenceResolver,
  resolveTour: ArticleReferenceResolver,
) {
  const links: ArticleRelatedLink[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const field of relatedFields) {
    for (const [index, id] of (fields[field] ?? []).entries()) {
      const target = (field === 'relatedTours' ? resolveTour : resolveArticle)(id, source.locale);
      const label = `${field}.${index}`;
      if (!target) errors.push(`${label}: destination "${id}" is missing or ambiguous in the ${field === 'relatedTours' ? 'tour' : 'article'} registry`);
      else if (target.href === source.href) errors.push(`${label}: cannot reference the current article`);
      else if (!seen.has(target.href)) {
        seen.add(target.href);
        links.push(target);
      }
    }
  }
  return { links, errors };
}
