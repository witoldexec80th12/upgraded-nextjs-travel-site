import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SITE } from '../src/config/site';
import { getEventConfig } from '../src/content';
import { ARTICLES } from '../src/data/articles';
import { getPublicPaths, resolveSitePage } from '../src/lib/site-pages';
import { getPagePresentation } from '../src/lib/page-metadata';
import { getMessages, translate } from '../src/i18n/messages';
import { getLegacyRedirects } from '../src/lib/legacy-redirects';
import { localizedHref } from '../src/lib/public-routing';
import sitemap from '../src/app/sitemap';
import robots from '../src/app/robots';
import { articlePolicy, type ArticleVariant } from '../src/lib/article-policy';
import type { Article } from '../src/lib/article-types';
import { withProductionServer } from './foundation-production-server';
import {
  articleExpectation, inspectArticleHtml, inspectArticleSitemap, sameLanguages,
} from './foundation-article-html';
import { auditPublicLinks } from './foundation-links';
import { writeLinkReport } from './foundation-link-report';
import { testLinkCrawler } from './foundation-link-fixtures';
import { publicLocales } from '../src/lib/public-routing';

const paths = getPublicPaths();
assert.equal(paths.length, new Set(paths).size);
assert.equal(resolveSitePage('/does-not-exist'), null);
assert.equal(resolveSitePage('/es/does-not-exist'), null);
assert.equal(resolveSitePage('/es/faq')?.locale, 'es');
assert.equal(resolveSitePage('/admin'), null);
assert.equal(translate(getMessages('es'), 'nav.tickets'), 'Entradas');
assert.equal(getPagePresentation('/en/success')?.noindex, true);
assert.equal(getPagePresentation('/en/booking/castle-tickets')?.noindex, true);
assert.equal(getPagePresentation('/es')?.isFallback, true);
assert.equal(getPagePresentation('/es')?.metadata.alternates?.canonical, `${SITE.origin}/en`);
assert.deepEqual(Object.keys(getPagePresentation('/en')!.metadata.alternates!.languages!), ['en', 'x-default']);
assert.equal(localizedHref('/schedule?full_adults=1#times', 'en'), '/en/booking/castle-tickets?full_adults=1#times');
assert.equal(localizedHref('/admin/login', 'it'), '/admin/login');
assert.equal(resolveSitePage('/en/tours/missing'), null);
assert.equal(resolveSitePage('/en/guides/missing'), null);
const redirects = getLegacyRedirects();
assert.equal(redirects.length, new Set(redirects.map((item) => item.source)).size);
for (const redirect of redirects) {
  assert.notEqual(redirect.source, redirect.destination);
  assert.ok(paths.includes(redirect.destination), `Redirect destination missing: ${redirect.destination}`);
  assert.ok(!redirects.some((item) => item.source === redirect.destination), 'Redirect chain/loop');
}

for (const article of ARTICLES) {
  const context = `${articleExpectation(article, ARTICLES).filename} [${SITE.origin}${article.href}]`;
  try {
  const page = getPagePresentation(article.href);
  assert.ok(page);
  assert.equal(page.page.locale, article.locale);
  assert.equal(page.metadata.alternates?.canonical, `${SITE.origin}${article.canonicalPath}`);
  assert.equal(article.canonicalPath, article.contentLocale === article.locale ? article.href : article.englishPath);
  assert.equal(page.metadata.openGraph?.url, `${SITE.origin}${article.canonicalPath}`);
  const languages = page.metadata.alternates?.languages;
  for (const alt of article.alternateRoutes) {
    assert.equal(languages?.[alt.locale], `${SITE.origin}${alt.path}`);
    const reciprocal = getPagePresentation(alt.path)!;
    assert.deepEqual(reciprocal.metadata.alternates?.languages, languages);
  }
  const articleNode = page.jsonLd.find((node) => (node as Record<string, unknown>)['@type'] === 'Article') as Record<string, unknown>;
  assert.equal(articleNode['@id'], `${SITE.origin}${article.canonicalPath}#article`);
  assert.equal(articleNode.mainEntityOfPage, `${SITE.origin}${article.canonicalPath}`);
  assert.ok(page.jsonLd.length);
  } catch (error) {
    throw new Error(`${context} registry/metadata validation: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Isolated policy fixtures exercise compiler output through the real metadata,
// JSON-LD and sitemap consumers without changing editorial files or public URLs.
const variants: ArticleVariant[] = [
  { locale: 'en', href: '/en/guides/policy-fixture', ogLocale: 'en_US', contentLocale: 'en', noindex: false },
  { locale: 'es', href: '/es/guides/ejemplo-politica', ogLocale: 'es_ES', contentLocale: 'es', noindex: false },
  { locale: 'de', href: '/de/guides/policy-fixture', ogLocale: 'de_DE', contentLocale: 'en', noindex: false },
  { locale: 'fr', href: '/fr/guides/exemple-politique', ogLocale: 'fr_FR', contentLocale: 'fr', noindex: true },
];
const fixtures: Article[] = variants.map((variant) => ({
  ...ARTICLES[0], ...variant, ...articlePolicy(variant, variants),
}));
ARTICLES.push(...fixtures);
try {
  const expectedLanguages = {
    en: `${SITE.origin}${variants[0].href}`,
    es: `${SITE.origin}${variants[1].href}`,
    'x-default': `${SITE.origin}${variants[0].href}`,
  };
  for (const fixture of fixtures) {
    const page = getPagePresentation(fixture.href)!;
    const fallback = fixture.contentLocale !== fixture.locale;
    const canonical = `${SITE.origin}${fallback ? variants[0].href : fixture.href}`;
    assert.equal(page.isFallback, fallback);
    assert.equal(page.noindex, fallback || fixture.noindex);
    assert.equal(page.metadata.alternates?.canonical, canonical);
    assert.equal(page.metadata.openGraph?.url, canonical);
    assert.deepEqual(page.metadata.alternates?.languages, fallback ? {} : expectedLanguages);
    for (const node of page.jsonLd as Record<string, unknown>[]) {
      if (['Article', 'WebPage'].includes(String(node['@type']))) {
        assert.equal(node.url, canonical);
        assert.equal(node.inLanguage, fixture.contentLocale);
        assert.equal(node['@id'], `${canonical}#${node['@type'] === 'Article' ? 'article' : 'webpage'}`);
      }
      if (node['@type'] === 'Article') assert.equal(node.mainEntityOfPage, canonical);
    }
    const entry = sitemap().find((item) => item.url === `${SITE.origin}${fixture.href}`);
    assert.equal(Boolean(entry), !page.noindex);
    if (entry) assert.deepEqual(entry.alternates?.languages, expectedLanguages);
  }
} finally {
  ARTICLES.splice(ARTICLES.length - fixtures.length, fixtures.length);
}

// Inspect actual production HTML, excluding React's scripts so serialized
// props cannot make a blank page look like successfully rendered content.
function builtHtml(path: string) {
  return readFileSync(`.next/server/app/${path === '/' ? 'index' : path.slice(1)}.html`, 'utf8');
}
function withoutScripts(html: string) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
}
for (const path of paths) {
  const article = getPagePresentation(path)?.page.article;
  const context = `${article ? articleExpectation(article, ARTICLES).filename : 'Next.js public route'} [${SITE.origin}${path}]`;
  try {
  const html = builtHtml(path);
  const presentation = getPagePresentation(path)!;
  assert.ok(html.includes('<title>'), `Missing title: ${path}`);
  assert.ok(html.includes('rel="canonical"'), `Missing canonical: ${path}`);
  assert.ok(html.includes('property="og:title"'), `Missing Open Graph: ${path}`);
  assert.ok(html.includes('name="twitter:card"'), `Missing Twitter metadata: ${path}`);
  if (!['/schedule', '/success'].includes(presentation.page.contentPath)) {
    assert.match(withoutScripts(html), /<h1\b/, `Missing initial HTML content: ${path}`);
    assert.match(withoutScripts(html), /<nav\b/, `Missing initial HTML navigation: ${path}`);
  }
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length > 0, `Missing structured data: ${path}`);
  for (const [, json] of scripts) assert.doesNotThrow(() => JSON.parse(json));
  const canonical = String(presentation.metadata.alternates!.canonical);
  assert.ok(html.includes(`rel="canonical" href="${canonical}"`), `Wrong canonical HTML: ${path}`);
  assert.ok(html.includes(`property="og:url" content="${canonical}"`), `Wrong og:url: ${path}`);
  if (presentation.isFallback) {
    assert.match(html, /name="robots" content="[^"]*noindex/, `Missing fallback noindex: ${path}`);
    assert.ok(withoutScripts(html).includes('Page content is currently available in English.'), `Missing fallback notice: ${path}`);
    assert.ok(!html.includes('hrefLang='), `Fallback advertises translations: ${path}`);
  }
  for (const [lang, href] of Object.entries(presentation.metadata.alternates?.languages ?? {})) {
    assert.ok(html.includes(`hrefLang="${lang}" href="${href}"`), `Missing hreflang ${lang}: ${path}`);
  }
  if (presentation.page.article) {
    const nodes = scripts.map(([, json]) => JSON.parse(json));
    const node = nodes.find((item) => item['@type'] === 'Article');
    assert.equal(node['@id'], `${canonical}#article`);
    assert.equal(node.mainEntityOfPage, canonical);
  }
  } catch (error) {
    throw new Error(`${context} generated HTML: ${error instanceof Error ? error.message : String(error)}`);
  }
}
const home = withoutScripts(builtHtml('/en'));
assert.ok(home.includes(getEventConfig('en').hero.title), 'Homepage is not rendered in initial HTML');
assert.ok(!home.includes('nav.tickets'), 'Translations were not preloaded');
assert.ok(!home.includes('VITE_'));
const rules = robots().rules as { disallow: string[] };
assert.ok(rules.disallow.includes('/admin'));
assert.ok(rules.disallow.includes('/en/success'));
const entries = sitemap();
assert.ok(entries.every((entry) => !/\/(success|booking|admin)(\/|$)/.test(new URL(entry.url).pathname)));
assert.ok(!entries.some((entry) => entry.url === `${SITE.origin}/es`));
assert.ok(entries.some((entry) => entry.url.includes('/es/guides/')));
const lockfile = readFileSync('package-lock.json', 'utf8');
assert.ok(!lockfile.includes('package-firewall.replit.local'), 'Lockfile contains a Replit-only registry URL');
// Exercise the HTML assertions themselves with isolated HTML fixtures, in this
// same command. No test pages, content, or images are added to the application.
const fixtureBody = 'This substantive article paragraph must be present in the initial HTML response, not merely serialized into a script.';
for (const fixture of fixtures) {
  const expectation = articleExpectation(fixture, fixtures);
  const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
  const html = `<!doctype html><html><head>
    <title>${escape(expectation.title)}</title>
    <meta name="description" content="${escape(expectation.description)}">
    <meta property="og:url" content="${expectation.canonical}">
    <link rel="canonical" href="${expectation.canonical}">
    <meta name="robots" content="${expectation.noindex ? 'noindex' : 'index'}, follow">
    ${Object.entries(expectation.languages).map(([lang, href]) => `<link rel="alternate" hreflang="${lang}" href="${href}">`).join('')}
    <script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org', '@graph': [{
        '@type': 'Article',
        '@id': `${expectation.canonical}#article`, url: expectation.canonical,
        mainEntityOfPage: expectation.canonical, inLanguage: expectation.contentLocale,
      }, {
        '@type': 'WebPage', '@id': `${expectation.canonical}#webpage`,
        url: expectation.canonical, inLanguage: expectation.contentLocale,
      }],
    })}</script></head><body>
    ${expectation.isFallback ? '<p>Page content is currently available in English.</p>' : ''}
    <main><article><h1>${escape(expectation.h1)}</h1>
    <p>${escape(expectation.lede!)}</p><div id="article-body"><p>${fixtureBody}</p></div>
    </article></main></body></html>`;
  expectation.body = fixtureBody;
  assert.deepEqual(inspectArticleHtml(html, expectation).errors, []);
  assert.ok(inspectArticleHtml(html.replace('</h1>', '</h1><h1>Extra heading</h1>'), expectation)
    .errors.some((error) => error.startsWith('h1:')));
  assert.ok(inspectArticleHtml(html.replace(`<p>${fixtureBody}</p>`,
    `<script>${JSON.stringify(fixtureBody)}</script>`), expectation).errors.some((error) => error.startsWith('body:')));
  assert.ok(inspectArticleHtml(html.replace('"@type":"Article"', '"@type":invalid'), expectation)
    .errors.some((error) => error.includes('invalid JSON')));
  assert.ok(inspectArticleHtml(html.replace('property="og:url"', 'property="wrong"'), expectation)
    .errors.some((error) => error.startsWith('og:url:')));
  assert.ok(inspectArticleHtml(html, expectation, 'noindex').errors.length > 0 || expectation.noindex);
  assert.ok(inspectArticleHtml(html.replace('<title>', '<title>Incorrect '), expectation)
    .errors.some((error) => error.startsWith('title:')));
  assert.ok(inspectArticleHtml(html.replace('name="description"', 'name="wrong"'), expectation)
    .errors.some((error) => error.startsWith('metaDescription:')));
  assert.ok(inspectArticleHtml(html.replace('rel="canonical"', 'rel="wrong"'), expectation)
    .errors.some((error) => error.startsWith('canonical:')));
  assert.ok(inspectArticleHtml(html.replace('"inLanguage":', '"incorrectLanguage":'), expectation)
    .errors.some((error) => error.includes('inLanguage')));
  if (!expectation.isFallback && !expectation.noindex) {
    assert.ok(inspectArticleHtml(html.replace('hreflang="en"', 'hreflang="wrong"'), expectation)
      .errors.some((error) => error.startsWith('hreflang:')));
  }
  assert.ok(inspectArticleSitemap(
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',
    [expectation],
  ).length > 0 || expectation.noindex);
  if (expectation.noindex) {
    assert.ok(inspectArticleSitemap(
      `<urlset><url><loc>${SITE.origin}${expectation.path}</loc></url></urlset>`, [expectation],
    ).some((error) => error.includes('expected exclusion')));
  }
}

await testLinkCrawler();
await withProductionServer(async (base) => {
  const errors: string[] = [];
  const expectations = ARTICLES.map((article) => articleExpectation(article, ARTICLES));
  // Legacy English fallback guide pages are still published URLs, though they
  // are not Markdown translations in the generated article registry.
  for (const path of paths) {
    const page = getPagePresentation(path)!;
    if (page.page.article || !page.isFallback || !path.includes('/guides/')) continue;
    const config = getEventConfig(page.page.locale);
    const legacy = config.discoverArticles.find((item) => page.page.contentPath === `/article/${item.slug}`)!;
    expectations.push({
      filename: `src/content/${page.contentLocale}/event.ts (discoverArticles.${legacy.slug})`,
      path, title: `${legacy.title}${SITE.metadata.titleSeparator}${config.brand.name}`,
      description: legacy.excerpt, h1: legacy.title, body: legacy.body.join('\n\n'),
      canonical: `${SITE.origin}/${page.contentLocale}/guides/${legacy.slug}`,
      contentLocale: page.contentLocale, isFallback: true, noindex: true,
      languages: {}, requireArticleSchema: false,
    });
  }
  const fetched = new Map<string, ReturnType<typeof inspectArticleHtml>>();
  async function response(path: string) {
    return fetch(`${base}${path}`, {
      redirect: 'manual', signal: AbortSignal.timeout(15000),
      headers: { Accept: 'text/html', 'User-Agent': 'Foundation-SEO-Test/1.0' },
    });
  }
  for (const expected of expectations) {
    const prefix = `${expected.filename} [${base}${expected.path}]`;
    try {
      const res = await response(expected.path);
      if (res.status !== 200) {
        errors.push(`${prefix} HTTP status: expected 200, received ${res.status}`);
        await res.body?.cancel();
        continue;
      }
      if (!res.headers.get('content-type')?.includes('text/html')) errors.push(`${prefix} Content-Type: expected HTML`);
      const result = inspectArticleHtml(await res.text(), expected, res.headers.get('x-robots-tag') ?? '');
      fetched.set(`${SITE.origin}${expected.path}`, result);
      errors.push(...result.errors.map((error) => `${prefix} ${error}`));
    } catch (error) {
      errors.push(`${prefix} request: ${String(error)}`);
    }
  }
  for (const expected of expectations.filter((item) => !item.noindex)) {
    const page = fetched.get(`${SITE.origin}${expected.path}`);
    for (const [language, url] of Object.entries(page?.languages ?? {})) {
      if (language === 'x-default') continue;
      const alternate = fetched.get(url);
      if (!alternate || !sameLanguages(alternate.languages, page!.languages)) {
        errors.push(`${expected.filename} [${base}${expected.path}] hreflang: nonreciprocal ${language} reference to ${url}`);
      }
    }
  }
  try {
    const res = await response('/sitemap.xml');
    if (res.status !== 200) errors.push(`sitemap.xml [${base}/sitemap.xml] HTTP status: expected 200, received ${res.status}`);
    else errors.push(...inspectArticleSitemap(await res.text(), expectations));
  } catch (error) { errors.push(`sitemap.xml [${base}/sitemap.xml]: ${String(error)}`); }
  for (const redirect of redirects) {
    try {
      const res = await response(`${redirect.source}?compat=1`);
      const target = new URL(res.headers.get('location') ?? '', base);
      if (res.status !== 308 || target.pathname !== redirect.destination || target.searchParams.get('compat') !== '1') {
        errors.push(`redirect registry [${base}${redirect.source}] expected 308 to ${redirect.destination} with query preserved`);
      }
      await res.body?.cancel();
    } catch (error) { errors.push(`redirect registry [${base}${redirect.source}]: ${String(error)}`); }
  }
  const unknown = [...new Set([
    '/xx', '/en/unknown', '/en/tours/missing', '/en/booking/missing',
    ...ARTICLES.map((article) => `/${article.locale}/guides/__foundation_unknown_article__`),
  ])];
  for (const path of unknown) {
    try {
      const res = await response(path);
      if (res.status !== 404) errors.push(`unknown route (no source file) [${base}${path}] HTTP status: expected 404, received ${res.status}`);
      await res.body?.cancel();
    } catch (error) { errors.push(`unknown route (no source file) [${base}${path}]: ${String(error)}`); }
  }
  if (!errors.length) console.log('Article SEO, sitemap, status, and legacy redirect assertions passed before the cross-page link audit.');
  const linkSummary = writeLinkReport(await auditPublicLinks({
    base, origin: SITE.origin, paths, locales: publicLocales, redirects,
  }));
  if (linkSummary.errors) {
    errors.push(`Cross-page internal links: ${linkSummary.errors} critical finding(s); see ${linkSummary.html} for source URLs, destinations, and link text.`);
  }
  if (errors.length) {
    console.error(`\nProduction foundation failures (${errors.length}):\n${errors.map((error) => `- ${error}`).join('\n')}`);
    throw new Error(`Foundation HTTP validation failed with ${errors.length} critical issue(s).`);
  }
  console.log(`Production HTTP checks passed: ${ARTICLES.length} registry articles, ${expectations.length - ARTICLES.length} English fallback guides, sitemap, ${redirects.length} redirects, and ${unknown.length} unknown routes.`);
});
console.log(`Foundation checks passed: ${paths.length} generated public pages and ${ARTICLES.length} article variants.`);
