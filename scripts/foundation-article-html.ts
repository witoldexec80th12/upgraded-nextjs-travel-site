import { load } from 'cheerio';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { Article } from '../src/lib/article-types';
import { SITE } from '../src/config/site';

export type ArticleExpectation = {
  filename: string;
  path: string;
  title: string;
  description: string;
  h1: string;
  lede?: string;
  body: string;
  canonical: string;
  contentLocale: string;
  isFallback: boolean;
  noindex: boolean;
  languages: Record<string, string>;
  requireArticleSchema: boolean;
};

export function articleExpectation(article: Article, registry: Article[]): ArticleExpectation {
  const isFallback = article.contentLocale !== article.locale;
  const translations = registry.filter((item) => item.englishPath === article.englishPath &&
    !item.noindex && item.contentLocale === item.locale);
  const languages = Object.fromEntries(translations.map((item) => [item.locale, `${SITE.origin}${item.href}`]));
  const english = translations.find((item) => item.locale === 'en');
  if (english) languages['x-default'] = `${SITE.origin}${english.href}`;
  return {
    filename: `src/content/${article.locale}/guides/${article.categoryPath}/${article.englishPath.split('/').at(-1)}.md`,
    path: article.href, title: article.title, description: article.metaDescription,
    h1: article.h1, lede: article.lede, body: article.body,
    canonical: `${SITE.origin}${isFallback ? article.englishPath : article.href}`,
    contentLocale: article.contentLocale, isFallback, noindex: isFallback || article.noindex,
    languages: isFallback ? {} : languages, requireArticleSchema: true,
  };
}

export const normalizeText = (text: string) => text.normalize('NFKC').replace(/\s+/gu, ' ').trim();
type MdNode = { type: string; value?: string; children?: MdNode[] };
function articleSamples(markdown: string): string[] {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown) as MdNode;
  const samples: string[] = [];
  function text(node: MdNode): string {
    if (['image', 'imageReference', 'footnoteReference', 'html'].includes(node.type)) return '';
    return node.value ?? node.children?.map(text).join('') ?? '';
  }
  function visit(node: MdNode) {
    if (node.type === 'paragraph') {
      const value = normalizeText(text(node));
      if (value.length >= 40) samples.push(value.slice(0, 160));
    } else node.children?.forEach(visit);
  }
  visit(tree);
  return samples.slice(0, 3);
}
export function sameLanguages(actual: Record<string, string>, expected: Record<string, string>) {
  return JSON.stringify(Object.entries(actual).sort()) === JSON.stringify(Object.entries(expected).sort());
}

/** Parse fetched HTML only. No browser, hydration, network assets, or JS execution. */
export function inspectArticleHtml(
  html: string, expected: ArticleExpectation, robotsHeader = '',
): { errors: string[]; languages: Record<string, string> } {
  const $ = load(html);
  const errors: string[] = [];
  const check = (condition: unknown, field: string, detail: string) => {
    if (!condition) errors.push(`${field}: ${detail}`);
  };
  const main = $('main');
  check(main.length === 1, 'main', `expected one main content element, found ${main.length}`);
  check(main.find('h1').length === 1, 'h1', `expected exactly one main-content H1, found ${main.find('h1').length}`);
  check(normalizeText(main.find('h1').text()) === normalizeText(expected.h1), 'h1', 'does not match frontmatter.h1');
  function oneValue(selector: string, attribute: string | undefined, value: string, field: string) {
    const nodes = $(selector);
    check(nodes.length === 1, field, `expected exactly one tag, found ${nodes.length}`);
    const actual = attribute ? nodes.attr(attribute) : nodes.text();
    check(actual === value, field, `expected ${JSON.stringify(value)}, received ${JSON.stringify(actual)}`);
  }
  oneValue('title', undefined, expected.title, 'title');
  oneValue('meta[name="description"]', 'content', expected.description, 'metaDescription');
  oneValue('link[rel="canonical"]', 'href', expected.canonical, 'canonical');
  oneValue('meta[property="og:url"]', 'content', expected.canonical, 'og:url');

  const languages: Record<string, string> = {};
  $('link[rel="alternate"][hreflang]').each((_, node) => {
    const lang = $(node).attr('hreflang') ?? '';
    const href = $(node).attr('href') ?? '';
    check(!Object.hasOwn(languages, lang), 'hreflang', `duplicate annotation for ${lang}`);
    languages[lang] = href;
  });
  check(sameLanguages(languages, expected.languages), 'hreflang',
    `expected ${JSON.stringify(expected.languages)}, received ${JSON.stringify(languages)}`);

  const directives = [
    ...$('meta[name="robots"], meta[name="googlebot"]').map((_, node) => $(node).attr('content') ?? '').get(),
    robotsHeader,
  ].join(',').toLowerCase().split(/[\s,]+/);
  const blocked = directives.includes('noindex') || directives.includes('none');
  check(blocked === expected.noindex, 'robots', expected.noindex ? 'missing noindex' : 'published article is blocked from indexing');

  // Script payloads and hidden templates cannot satisfy visible SSR checks.
  const visible = main.clone();
  visible.find('script, style, template, noscript, [hidden], [aria-hidden="true"], sup:has(a[data-footnote-ref])').remove();
  const body = visible.find('#article-body');
  const renderedText = normalizeText((body.length ? body : visible).text());
  if (expected.lede) check(normalizeText(visible.text()).includes(normalizeText(expected.lede)), 'lede', 'missing from initial HTML');
  const samples = articleSamples(expected.body);
  check(samples.length > 0, 'body', 'no substantive source paragraph available for SSR verification');
  for (const sample of samples) {
    check(renderedText.includes(sample), 'body', `source text absent from initial HTML: ${JSON.stringify(sample)}`);
  }
  if (expected.isFallback) {
    const visiblePage = $('body').clone();
    visiblePage.find('script, style, template, noscript, [hidden], [aria-hidden="true"]').remove();
    check(normalizeText(visiblePage.text()).includes('Page content is currently available in English.'),
      'fallbackNotice', 'missing visible untranslated-content notice');
  }

  const nodes: Record<string, unknown>[] = [];
  const scripts = $('script[type="application/ld+json"]');
  check(scripts.length > 0, 'jsonLd', 'no JSON-LD scripts in initial HTML');
  function collect(value: unknown, inheritedContext = false) {
    if (Array.isArray(value)) { value.forEach((item) => collect(item, inheritedContext)); return; }
    if (!value || typeof value !== 'object') {
      errors.push('jsonLd: script must contain JSON-LD objects, arrays, or an @graph');
      return;
    }
    const node = value as Record<string, unknown>;
    const hasContext = inheritedContext || Boolean(node['@context']);
    if (!hasContext) errors.push('jsonLd: missing @context');
    if (node['@graph']) collect(node['@graph'], hasContext);
    if (node['@type']) nodes.push(node);
    else if (!node['@graph']) errors.push('jsonLd: root node has neither @type nor @graph');
  }
  scripts.each((index, script) => {
    try { collect(JSON.parse($(script).text())); }
    catch (error) { errors.push(`jsonLd[${index}]: invalid JSON: ${String(error)}`); }
  });
  const typed = (node: Record<string, unknown>, type: string) =>
    Array.isArray(node['@type']) ? node['@type'].includes(type) : node['@type'] === type;
  const articles = nodes.filter((node) => typed(node, 'Article'));
  if (expected.requireArticleSchema) check(articles.length === 1, 'jsonLd.Article', `expected one Article node, found ${articles.length}`);
  if (expected.requireArticleSchema) {
    const pages = nodes.filter((node) => typed(node, 'WebPage'));
    check(pages.length === 1, 'jsonLd.WebPage', `expected one WebPage node, found ${pages.length}`);
  }
  for (const node of nodes) {
    if (!typed(node, 'Article') && !typed(node, 'WebPage')) continue;
    const isArticle = typed(node, 'Article');
    const field = `jsonLd.${isArticle ? 'Article' : 'WebPage'}`;
    check(node['@id'] === `${expected.canonical}#${isArticle ? 'article' : 'webpage'}`, `${field}.@id`, 'incorrect localized identifier');
    if (Object.hasOwn(node, 'url')) check(node.url === expected.canonical, `${field}.url`, 'incorrect localized URL');
    check(node.inLanguage === expected.contentLocale, `${field}.inLanguage`, `expected ${expected.contentLocale}`);
    if (isArticle) {
      const page = typeof node.mainEntityOfPage === 'object' && node.mainEntityOfPage !== null
        ? (node.mainEntityOfPage as Record<string, unknown>)['@id'] : node.mainEntityOfPage;
      check(page === expected.canonical || page === `${expected.canonical}#webpage`, `${field}.mainEntityOfPage`, 'incorrect localized URL');
    }
  }
  return { errors, languages };
}

export function inspectArticleSitemap(xml: string, expectations: ArticleExpectation[]): string[] {
  const $ = load(xml, { xml: true });
  const errors: string[] = [];
  if ($('urlset').length !== 1) return ['sitemap.xml: expected a urlset XML document'];
  for (const expected of expectations) {
    const url = `${SITE.origin}${expected.path}`;
    const entries = $('url').filter((_, node) => $(node).children('loc').text() === url);
    const prefix = `${expected.filename} [${url}]`;
    if (entries.length !== (expected.noindex ? 0 : 1)) {
      errors.push(`${prefix} sitemap: expected ${expected.noindex ? 'exclusion' : 'exactly one entry'}, found ${entries.length}`);
    }
    if (expected.noindex) {
      if ($('[hreflang]').toArray().some((node) => $(node).attr('href') === url)) {
        errors.push(`${prefix} sitemap.hreflang: excluded article is advertised as an alternate`);
      }
    } else if (entries.length === 1) {
      const languages: Record<string, string> = {};
      entries.find('[hreflang]').each((_, node) => {
        const lang = $(node).attr('hreflang') ?? '';
        if (Object.hasOwn(languages, lang)) errors.push(`${prefix} sitemap.hreflang: duplicate ${lang}`);
        languages[lang] = $(node).attr('href') ?? '';
      });
      if (!sameLanguages(languages, expected.languages)) errors.push(`${prefix} sitemap.hreflang: does not match indexable translation registry`);
    }
  }
  return errors;
}
