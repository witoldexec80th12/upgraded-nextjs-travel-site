import { realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { ArticleRelatedLink } from '../src/lib/article-types';
import { articleReferencePattern, referenceIdPattern, type ArticleReferenceResolver } from './article-references';

const text = z.string().min(1, 'is required').regex(/\S/, 'must not be whitespace-only');
const httpUrl = text.refine((value) => {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
}, 'must be an absolute HTTP(S) URL');
const date = z.union([text, z.date()]).transform((value) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : value);
const frontmatterSchema = z.object({
  slug: text.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be a lowercase hyphen-separated slug'),
  title: text,
  metaDescription: text,
  h1: text,
  lede: text,
  datePublished: date,
  dateModified: date,
  locale: text.optional(),
  lang: text.optional(),
  ogLocale: text.regex(/^[a-z]{2,3}_[A-Z]{2}$/, 'must use language_REGION, e.g. en_US'),
  contentLocale: text.optional(),
  noindex: z.boolean().optional(),
  category: text.optional(),
  readTime: text.optional(),
  hero: z.object({
    mobile: text, mobile2x: text, desktop: text, desktop2x: text,
    fallback: text, og: text.optional(), alt: text,
    width: z.number().int().positive(), height: z.number().int().positive(),
    focal: text.optional(), creditText: text.optional(),
  }),
  breadcrumbs: z.array(z.object({ name: text, path: text.nullable() })).min(1),
  keyFacts: z.array(z.object({ name: text, description: text })),
  faqHeading: text.optional(),
  faq: z.array(z.object({ q: text, a: text })).optional(),
  sources: z.array(z.object({ title: text, url: httpUrl })).optional(),
  relatedGuides: z.array(text.regex(articleReferencePattern, 'must be a stable article ID or category/ID')).optional(),
  relatedArticles: z.array(text.regex(articleReferencePattern, 'must be a stable article ID or category/ID')).optional(),
  relatedTours: z.array(text.regex(referenceIdPattern, 'must be a tour slug')).optional(),
  author: z.object({ name: text, url: httpUrl.optional() }).optional(),
  schemaEntity: z.object({
    type: text, name: text, url: httpUrl.optional(),
    sameAs: z.array(httpUrl).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  }).optional(),
});

function validCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function imageError(value: string, publicDir: string): string | undefined {
  try {
    const decoded = decodeURIComponent(value);
    if (!decoded.startsWith('/') || decoded.startsWith('//') ||
        /[\\?#\u0000]/.test(decoded) || decoded.split('/').some((part) => part === '.' || part === '..')) {
      return 'must be a root-relative public asset path without traversal, query, or fragment';
    }
    const root = realpathSync(publicDir);
    const target = realpathSync(path.join(root, decoded.slice(1)));
    const relative = path.relative(root, target);
    if (relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) {
      return 'must resolve inside public/';
    }
    if (!statSync(target).isFile()) return 'must reference a file in public/';
  } catch {
    return `image file does not exist in public/: ${value}`;
  }
}

/** Return all errors; never mutate source metadata or write generated output. */
export function validateFrontmatter(
  value: unknown, publicDir: string, locale: string, rawYaml = '',
): string[] {
  const result = frontmatterSchema.safeParse(value);
  const errors = result.success ? [] : result.error.issues.map((issue) =>
    `${issue.path.join('.') || 'frontmatter'}: ${issue.message}`);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return errors;
  const fields = value as Record<string, unknown>;
  for (const key of ['locale', 'lang']) {
    if (fields[key] !== undefined && fields[key] !== locale) errors.push(`${key}: must match directory locale "${locale}"`);
  }
  if (fields.contentLocale !== undefined && fields.contentLocale !== locale && fields.contentLocale !== 'en') {
    errors.push('contentLocale: must be the page locale or en for an English fallback');
  }
  const dates: Record<string, string> = {};
  for (const key of ['datePublished', 'dateModified']) {
    const source = fields[key];
    // YAML timestamps can normalize impossible dates before validation. Check
    // the original scalar as well when it is an unquoted ISO calendar date.
    const raw = rawYaml.match(new RegExp(`^${key}:\\s*(\\d{4}-\\d{2}-\\d{2})(?=\\s*(?:#.*)?$)`, 'm'))?.[1];
    const normalized = raw ?? (source instanceof Date && Number.isFinite(source.getTime())
      ? source.toISOString().slice(0, 10) : typeof source === 'string' ? source : '');
    if (!validCalendarDate(normalized)) errors.push(`${key}: must be an actual calendar date in YYYY-MM-DD format`);
    else dates[key] = normalized;
  }
  if (dates.datePublished && dates.dateModified && dates.dateModified < dates.datePublished) {
    errors.push('dateModified: must be on or after datePublished');
  }
  const hero = fields.hero;
  if (hero && typeof hero === 'object' && !Array.isArray(hero)) {
    for (const key of ['mobile', 'mobile2x', 'desktop', 'desktop2x', 'fallback', 'og']) {
      const asset = (hero as Record<string, unknown>)[key];
      if (typeof asset !== 'string' || !asset.trim()) continue;
      const error = imageError(asset, publicDir);
      if (error) errors.push(`hero.${key}: ${error}`);
    }
  }
  return errors;
}

type MarkdownNode = {
  type: string; depth?: number; url?: string; value?: string; identifier?: string;
  children?: MarkdownNode[]; position?: { start: { line: number } };
};

export type ArticleLinkSource = {
  file: string; body: string; href: string; legacyPath: string; locale: string;
};

/** Parse Markdown as the renderer does, so examples inside code are ignored. */
export function validateArticleMarkdown(
  source: ArticleLinkSource, registry: ArticleLinkSource[], origin: string,
  resolveArticle?: ArticleReferenceResolver, links?: Record<string, ArticleRelatedLink>,
): string[] {
  const errors: string[] = [];
  const tree = unified().use(remarkParse).use(remarkGfm).parse(source.body) as MarkdownNode;
  const routes = new Set(registry.flatMap((article) => [article.href, article.legacyPath]));
  const categories = new Set(registry.map((article) => article.legacyPath.split('/')[1]));
  const definitions = new Map<string, string>();
  function visit(node: MarkdownNode, action: (node: MarkdownNode) => void) {
    if (node.type === 'code' || node.type === 'inlineCode') return;
    action(node);
    node.children?.forEach((child) => visit(child, action));
  }
  visit(tree, (node) => {
    if (node.type === 'definition' && node.identifier && node.url) definitions.set(node.identifier, node.url);
  });
  function checkLink(url: string, field: string) {
    const target = url;
    if (target.includes('INTERNAL-LINK:')) {
      const token = target.startsWith('INTERNAL-LINK:') ? target.slice('INTERNAL-LINK:'.length) : '';
      const resolved = articleReferencePattern.test(token) ? resolveArticle?.(token, source.locale) : undefined;
      if (!resolved) errors.push(`${field}: unresolved INTERNAL-LINK token "${target}"; expected a registered stable article ID`);
      else if (links) links[target] = resolved;
      return;
    }
    try {
      const resolved = new URL(target, new URL(source.href, origin));
      if (resolved.origin !== new URL(origin).origin) return;
      const pathname = decodeURIComponent(resolved.pathname).replace(/\/$/, '') || '/';
      if ((/^\/[a-z]{2,3}\/guides(?:\/|$)/.test(pathname) ||
          categories.has(pathname.split('/')[1])) && !routes.has(pathname)) {
        errors.push(`${field}: article is not in the content registry: ${target}`);
      }
    } catch {
      errors.push(`${field}: invalid link URL "${url}"`);
    }
  }
  visit(tree, (node) => {
    const field = `body (line ${node.position?.start.line ?? '?'})`;
    if (node.type === 'heading' && node.depth === 1) {
      errors.push(`${field}: additional H1 is not allowed; use frontmatter.h1 and body H2/H3 headings`);
    }
    if (node.type === 'link' && node.url) checkLink(node.url, field);
    if (node.type === 'definition' && node.url) checkLink(node.url, field);
    if (node.type === 'linkReference' && node.identifier) {
      const url = definitions.get(node.identifier);
      if (url) checkLink(url, field);
    }
    if (node.type === 'text' && node.value?.includes('INTERNAL-LINK:')) {
      errors.push(`${field}: unresolved INTERNAL-LINK token in text`);
    }
  });
  return errors;
}
