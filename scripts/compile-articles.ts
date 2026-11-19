/**
 * Compile localized Markdown article groups into typed article data and routes.
 *
 * Source layout:
 *   src/content/<locale>/guides/<category>/<english-slug>.md
 *
 * Generated files are written under src/data/articles/ and src/lib/article-routes.ts.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { articlePolicy } from '../src/lib/article-policy';
import { validateFrontmatter, validateArticleMarkdown } from './article-validation';
import { SITE } from '../src/config/site';
import { getPackage } from '../src/lib/packages';
import type { ArticleRelatedLink } from '../src/lib/article-types';
import { createArticleReferenceResolver, resolveRelatedContent } from './article-references';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = path.resolve(__dirname, '../src/content');
const OUTPUT_DIR = path.resolve(__dirname, '../src/data/articles');
const ROUTES_FILE = path.resolve(__dirname, '../src/lib/article-routes.ts');

const OG_LOCALES: Record<string, string> = {
  en: 'en_US',
  es: 'es_ES',
  fr: 'fr_FR',
  de: 'de_DE',
  it: 'it_IT',
  pl: 'pl_PL',
  pt: 'pt_PT',
  nl: 'nl_NL',
  el: 'el_GR',
  ru: 'ru_RU',
  ko: 'ko_KR',
  ja: 'ja_JP',
  zh: 'zh_CN',
  ro: 'ro_RO',
  cs: 'cs_CZ',
  hu: 'hu_HU',
  hr: 'hr_HR',
  sk: 'sk_SK',
};

type SourceArticle = {
  file: string;
  categoryPath: string;
  groupSlug: string;
  locale: string;
  slug: string;
  category: string;
  readTime: string;
  frontmatter: Record<string, any>;
  body: string;
};

type Group = {
  categoryPath: string;
  slug: string;
  articles: SourceArticle[];
};

function fail(message: string): never {
  console.error(`[compile-articles] ✗ ${message}`);
  process.exit(1);
}

function listMarkdownFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory()
      ? listMarkdownFiles(fullPath)
      : entry.isFile() && entry.name.endsWith('.md')
        ? [fullPath]
        : [];
  });
}

function normalizeDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return typeof value === 'string' ? value : '';
}

function normalizePath(value: string): string {
  const normalized = `/${value}`.replace(/\/+/g, '/').replace(/\/$/, '');
  return normalized || '/';
}

function toCamel(value: string): string {
  return value.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

function serialize(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, item) => (item instanceof Date ? item.toISOString().slice(0, 10) : item),
    2,
  );
}

function articlePath(categoryPath: string, locale: string, slug: string): string {
  return normalizePath(`${locale}/guides/${slug}`);
}

function readSource(file: string): SourceArticle {
  const relative = path.relative(CONTENT_DIR, file).split(path.sep);
  if (relative.length !== 4 || relative[1] !== 'guides') {
    fail(
      `${path.relative(process.cwd(), file)} must be at ` +
        `src/content/<locale>/guides/<category>/<english-slug>.md`,
    );
  }

  const [filenameLocale, , categoryPath, filename] = relative;
  const groupSlug = filename.replace(/\.md$/, '');
  if (!/^[a-z][a-z0-9-]*$/.test(categoryPath) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(groupSlug)) {
    fail(`${path.relative(process.cwd(), file)} has an invalid category or article folder name.`);
  }
  if (!/^[a-z]{2,3}$/.test(filenameLocale)) {
    fail(`${path.relative(process.cwd(), file)} must use a locale filename such as en.md or es.md.`);
  }

  const parsed = matter(readFileSync(file, 'utf-8'));
  const { data: frontmatter, content } = parsed;
  const issues = validateFrontmatter(
    frontmatter, path.resolve(__dirname, '../public'), filenameLocale, parsed.matter,
  );
  if (issues.length) throw new Error(issues.join('\n'));
  const locale = String(frontmatter.locale ?? frontmatter.lang ?? filenameLocale);
  if (locale !== filenameLocale) {
    fail(
      `${path.relative(process.cwd(), file)}: filename locale '${filenameLocale}' ` +
        `does not match frontmatter locale '${locale}'.`,
    );
  }
  if (frontmatter.contentLocale !== undefined &&
      frontmatter.contentLocale !== locale && frontmatter.contentLocale !== 'en') {
    fail(`${file}: contentLocale must be the page locale or en for an English fallback.`);
  }
  if (frontmatter.noindex !== undefined && typeof frontmatter.noindex !== 'boolean') {
    fail(`${file}: noindex must be a boolean.`);
  }

  const required = [
    'slug',
    'title',
    'metaDescription',
    'h1',
    'lede',
    'datePublished',
    'dateModified',
    'hero',
    'breadcrumbs',
    'keyFacts',
  ];
  const missing = required.filter((key) => frontmatter[key] === undefined || frontmatter[key] === null || frontmatter[key] === '');
  if (missing.length) {
    fail(`${path.relative(process.cwd(), file)} is missing required field(s): ${missing.join(', ')}.`);
  }

  if (typeof frontmatter.ogLocale !== 'string' || !/^[a-z]{2,3}_[A-Z]{2}$/.test(frontmatter.ogLocale)) {
    const suggested = OG_LOCALES[locale];
    fail(
      `${path.relative(process.cwd(), file)}: add an explicit 'ogLocale' field` +
        `${suggested ? ` (suggested: ${suggested})` : ''}. See ARTICLES.md §6.`,
    );
  }

  const slug = String(frontmatter.slug);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    fail(`${path.relative(process.cwd(), file)}: slug must contain lowercase letters, numbers, and hyphens only.`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizeDate(frontmatter.datePublished))) {
    fail(`${path.relative(process.cwd(), file)}: datePublished must use YYYY-MM-DD.`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizeDate(frontmatter.dateModified))) {
    fail(`${path.relative(process.cwd(), file)}: dateModified must use YYYY-MM-DD.`);
  }
  if (!frontmatter.hero?.mobile || !frontmatter.hero?.desktop || !frontmatter.hero?.alt) {
    fail(`${path.relative(process.cwd(), file)}: hero must include mobile, desktop, and alt.`);
  }
  if (
    frontmatter.schemaEntity !== undefined &&
    (typeof frontmatter.schemaEntity?.type !== 'string' ||
      typeof frontmatter.schemaEntity?.name !== 'string' ||
      !frontmatter.schemaEntity.name.trim())
  ) {
    fail(`${path.relative(process.cwd(), file)}: schemaEntity must include a type and name.`);
  }
  if (frontmatter.schemaEntity?.url) {
    try {
      const url = new URL(frontmatter.schemaEntity.url);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol');
    } catch {
      fail(`${path.relative(process.cwd(), file)}: schemaEntity.url must be an absolute HTTP or HTTPS URL.`);
    }
  }

  frontmatter.datePublished = normalizeDate(frontmatter.datePublished);
  frontmatter.dateModified = normalizeDate(frontmatter.dateModified);

  return {
    file,
    categoryPath,
    groupSlug,
    locale,
    slug,
    category: String(frontmatter.category ?? categoryPath),
    readTime: String(frontmatter.readTime ?? '5 min read'),
    frontmatter,
    body: content.trim(),
  };
}

const files = listMarkdownFiles(CONTENT_DIR).filter((file) =>
  path.relative(CONTENT_DIR, file).split(path.sep)[1] === 'guides').sort();
if (!files.length) fail('No guide Markdown files found under src/content/.');

const groupsByKey = new Map<string, Group>();
const validationErrors: string[] = [];
const articles = files.flatMap((file) => {
  try {
    return [readSource(file)];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    validationErrors.push(...message.split('\n').map((line) =>
      `${path.relative(process.cwd(), file)}: ${line}`));
    return [];
  }
});
const linkRegistry = articles.map((article) => ({
  file: article.file,
  body: article.body,
  locale: article.locale,
  href: articlePath(article.categoryPath, article.locale, article.slug),
  legacyPath: `/${article.categoryPath}/${article.locale === 'en' ? '' : `${article.locale}/`}${article.slug}`,
}));
const resolveArticle = createArticleReferenceResolver(articles.map((article, index) => ({
  id: article.groupSlug,
  category: article.categoryPath,
  locale: article.locale,
  contentLocale: String(article.frontmatter.contentLocale ?? article.locale),
  href: linkRegistry[index].href,
  title: article.frontmatter.title,
})));
const navigation = new Map<string, {
  internalLinks?: Record<string, ArticleRelatedLink>;
  relatedContent?: ArticleRelatedLink[];
}>();
// Report metadata errors first so incomplete sources do not cause misleading
// "missing article" link errors. No generated files are touched on failure.
if (!validationErrors.length) {
  for (const [index, source] of linkRegistry.entries()) {
    const internalLinks: Record<string, ArticleRelatedLink> = {};
    const markdownErrors = validateArticleMarkdown(source, linkRegistry, SITE.origin, resolveArticle, internalLinks);
    const { links, errors } = resolveRelatedContent(
      articles[index].frontmatter, source, resolveArticle, (slug, locale) => {
        const tour = getPackage(slug, locale);
        return tour && { href: `/${locale}/tours/${tour.slug}`, title: tour.title, locale: tour.contentLocale };
      },
    );
    validationErrors.push(...[...markdownErrors, ...errors]
      .map((error) => `${path.relative(process.cwd(), source.file)}: ${error}`));
    navigation.set(source.file, {
      ...(Object.keys(internalLinks).length ? { internalLinks } : {}),
      ...(links.length ? { relatedContent: links } : {}),
    });
  }
}
if (validationErrors.length) fail(`Article validation failed:\n${validationErrors.join('\n')}`);

for (const article of articles) {
  const key = `${article.categoryPath}/${article.groupSlug}`;
  const group = groupsByKey.get(key) ?? {
    categoryPath: article.categoryPath,
    slug: article.groupSlug,
    articles: [],
  };
  group.articles.push(article);
  groupsByKey.set(key, group);
}

const seenRoutes = new Set<string>();
const articleRecords: Array<{
  importName: string;
  importPath: string;
  article: Record<string, unknown>;
  source: SourceArticle;
}> = [];

rmSync(OUTPUT_DIR, { recursive: true, force: true });
mkdirSync(OUTPUT_DIR, { recursive: true });

for (const group of groupsByKey.values()) {
  const english = group.articles.find((article) => article.locale === 'en');
  if (!english) fail(`${group.categoryPath}/${group.slug} has no en.md canonical source.`);
  if (english.slug !== group.slug) {
    fail(
      `${english.file}: the English slug '${english.slug}' must match its stable folder name '${group.slug}'.`,
    );
  }

  const localesInGroup = new Set<string>();
  const variants = group.articles.map((article) => {
    if (localesInGroup.has(article.locale)) {
      fail(`${group.categoryPath}/${group.slug} has more than one ${article.locale} translation.`);
    }
    localesInGroup.add(article.locale);
    const href = articlePath(group.categoryPath, article.locale, article.slug);
    if (seenRoutes.has(href)) fail(`duplicate article route '${href}'.`);
    seenRoutes.add(href);
    return { article, href };
  });

  const policyVariants = variants.map(({ article, href }) => ({
    locale: article.locale,
    href,
    ogLocale: String(article.frontmatter.ogLocale),
    contentLocale: String(article.frontmatter.contentLocale ?? article.locale),
    noindex: article.frontmatter.noindex === true,
  }));

  for (const { article, href } of variants) {
    const fm = article.frontmatter;
    const compiled: Record<string, unknown> = {
      slug: article.slug,
      locale: article.locale,
      ogLocale: fm.ogLocale,
      categoryPath: article.categoryPath,
      href,
      ...articlePolicy(policyVariants.find((item) => item.href === href)!, policyVariants),
      title: fm.title,
      metaDescription: fm.metaDescription,
      h1: fm.h1,
      lede: fm.lede,
      datePublished: fm.datePublished,
      dateModified: fm.dateModified,
      hero: fm.hero,
      breadcrumbs: fm.breadcrumbs.map((item: { name: string; path: string | null }) => ({
        ...item, path: item.path === '/' ? `/${article.locale}` : item.path,
      })),
      keyFacts: fm.keyFacts,
      body: article.body,
      ...navigation.get(article.file),
    };
    if (fm.faqHeading) compiled.faqHeading = fm.faqHeading;
    if (fm.faq?.length) compiled.faq = fm.faq;
    if (fm.sources?.length) compiled.sources = fm.sources;
    if (fm.author) compiled.author = fm.author;
    if (fm.schemaEntity) compiled.schemaEntity = fm.schemaEntity;

    const importName = `_${articleRecords.length}_${toCamel(article.categoryPath)}_${toCamel(group.slug)}_${article.locale}`;
    const importPath = `./${article.categoryPath}/${group.slug}/${article.locale}`;
    const outDir = path.join(OUTPUT_DIR, article.categoryPath, group.slug);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(
      path.join(outDir, `${article.locale}.ts`),
      `// @generated — source: src/content/${article.locale}/guides/${article.categoryPath}/${group.slug}.md\n` +
        `// Run \`npm run articles\` to regenerate.\n` +
        `import type { Article } from '@/lib/article-types';\n\n` +
        `const article: Article = ${serialize(compiled)};\n\nexport default article;\n`,
    );
    articleRecords.push({ importName, importPath, article: compiled, source: article });
    console.log(`[compile-articles] ✓ ${href}`);
  }

}

// Each group index re-exports its English canonical variant.
for (const record of articleRecords) {
  const groupKey = `${record.source.categoryPath}/${record.source.groupSlug}`;
  if (record.source.locale !== 'en') continue;
  const groupDir = path.join(OUTPUT_DIR, record.source.categoryPath, record.source.groupSlug);
  writeFileSync(
    path.join(groupDir, 'index.ts'),
    `// @generated — English canonical article for ${groupKey}.\nexport { default } from './en';\n`,
  );
}

const importLines = articleRecords
  .map(({ importName, importPath }) => `import ${importName} from '${importPath}';`)
  .join('\n');
const registryItems = articleRecords
  .filter(({ source }) => source.locale === 'en')
  .map(({ importName, source }) =>
    `  { ...${importName}, category: ${JSON.stringify(source.category)}, readTime: ${JSON.stringify(source.readTime)} },`,
  )
  .join('\n');
const articleItems = articleRecords.map(({ importName }) => `  ${importName},`).join('\n');
const routeItems = articleRecords
  .map(({ article }) => {
    const href = article.href as string;
    return `  { path: ${JSON.stringify(href)}, key: ${JSON.stringify(`article-${href.slice(1).replaceAll('/', '-')}`)} },`;
  })
  .join('\n');

const routeGroups = [...groupsByKey.values()]
  .map((group) => {
    const paths = group.articles
      .map((article) => `    ${JSON.stringify(article.locale)}: ${JSON.stringify(articlePath(group.categoryPath, article.locale, article.slug))},`)
      .join('\n');
    return `  ${JSON.stringify(articlePath(group.categoryPath, 'en', group.slug))}: {\n${paths}\n  },`;
  })
  .join('\n');

const dataIndex = `// @generated — do not edit. Source: src/content/<locale>/guides/**/*.md
// Run \`npm run articles\` to regenerate.
import type { Article } from '@/lib/article-types';

${importLines}

/** Every published locale variant; drives app routes, prerendering, and SEO. */
export const ARTICLES: Article[] = [
${articleItems}
];

export type ArticleRegistryEntry = Article & {
  category: string;
  readTime: string;
};

/** One English card per article group for the template's Discover section. */
export const articles: ArticleRegistryEntry[] = [
${registryItems}
];

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find((article) => article.slug === slug && article.locale === 'en');
}

export function getArticleByPath(path: string): Article | undefined {
  const normalized = \`/\${path}\`.replace(/\\/+/g, '/').replace(/\\/$/, '') || '/';
  return ARTICLES.find((article) => article.href === normalized);
}
`;

writeFileSync(path.join(OUTPUT_DIR, 'index.ts'), dataIndex);

const routesOut = `// @generated — do not edit. Source: src/content/<locale>/guides/**/*.md
// Run \`npm run articles\` to regenerate.

export const articleRoutes: Array<{ path: string; key: string; noindex?: boolean }> = [
${routeItems}
];

export const legacyArticleRedirects = ${serialize(articleRecords.map(({ source, article }) => ({
  source: `/${source.categoryPath}/${source.locale === 'en' ? '' : `${source.locale}/`}${source.slug}`,
  destination: article.href,
  permanent: true,
})))};

/** Locale-specific article paths keyed by each English canonical path. */
export const articleLocalePaths: Record<string, Record<string, string>> = {
${routeGroups}
};

function normalizeArticlePath(path: string): string {
  return \`/\${path}\`.replace(/\\/+/g, '/').replace(/\\/$/, '') || '/';
}

export function getArticleLocalePathsForPath(path: string): Record<string, string> | undefined {
  const normalized = normalizeArticlePath(path);
  return Object.values(articleLocalePaths).find((paths) => Object.values(paths).includes(normalized));
}

export function getArticleLocaleFromPath(path: string): string | undefined {
  const normalized = normalizeArticlePath(path);
  for (const paths of Object.values(articleLocalePaths)) {
    for (const [locale, href] of Object.entries(paths)) {
      if (href === normalized) return locale;
    }
  }
  return undefined;
}
`;
writeFileSync(ROUTES_FILE, routesOut);

console.log(
  `[compile-articles] Done — ${articles.length} locale article(s) across ${groupsByKey.size} group(s).`,
);
