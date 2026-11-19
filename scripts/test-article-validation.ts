import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, cpSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import { load } from 'cheerio';
import { validateFrontmatter, validateArticleMarkdown, type ArticleLinkSource } from './article-validation';
import { createArticleReferenceResolver } from './article-references';
import { articleLinkUrlTransform } from '../src/components/article/article-link-url';
import { RelatedContent } from '../src/components/article/RelatedContent';

const temp = mkdtempSync(path.join(os.tmpdir(), 'article-validation-'));
const publicDir = path.join(temp, 'public');
mkdirSync(path.join(publicDir, 'articles', 'fixture'), { recursive: true });
for (const name of ['mobile.webp', 'mobile@2x.webp', 'desktop.webp', 'desktop@2x.webp', 'fallback.jpg', 'og.jpg']) {
  writeFileSync(path.join(publicDir, 'articles', 'fixture', name), 'fixture asset');
}
after(() => rmSync(temp, { recursive: true, force: true }));
function valid(): Record<string, any> {
  return {
    slug: 'fixture', title: 'Article', metaDescription: 'A description', h1: 'Heading', lede: 'Introduction',
    datePublished: '2024-02-29', dateModified: '2024-03-01', locale: 'en', ogLocale: 'en_US',
    hero: {
      mobile: '/articles/fixture/mobile.webp', mobile2x: '/articles/fixture/mobile@2x.webp',
      desktop: '/articles/fixture/desktop.webp', desktop2x: '/articles/fixture/desktop@2x.webp',
      fallback: '/articles/fixture/fallback.jpg', og: '/articles/fixture/og.jpg',
      alt: 'A fixture', width: 1440, height: 960,
    },
    breadcrumbs: [{ name: 'Home', path: '/' }, { name: 'Article', path: null }],
    keyFacts: [{ name: 'Fact', description: 'Value' }],
    faq: [{ q: 'Question?', a: 'Answer.' }],
    sources: [{ title: 'Official', url: 'https://example.org' }],
    author: { name: 'Author', url: 'https://example.org/author' },
    schemaEntity: { type: 'TouristAttraction', name: 'Subject', latitude: 45, longitude: 20 },
  };
}
function rejects(change: (fm: Record<string, any>) => void, field: string) {
  const fm = valid();
  change(fm);
  assert.ok(validateFrontmatter(fm, publicDir, 'en').some((error) => error.startsWith(`${field}:`)), field);
}
test('complete existing frontmatter format passes without mutating it', () => {
  const fm = valid(), before = structuredClone(fm);
  assert.deepEqual(validateFrontmatter(fm, publicDir, 'en'), []);
  assert.deepEqual(fm, before);
});
test('required scalar fields reject missing, wrong-type and whitespace-only values', () => {
  for (const field of ['slug', 'title', 'metaDescription', 'h1', 'lede', 'ogLocale']) {
    rejects((fm) => delete fm[field], field);
    rejects((fm) => { fm[field] = 123; }, field);
    rejects((fm) => { fm[field] = ' \n\t '; }, field);
  }
});
test('nested structures have field-specific errors', () => {
  rejects((fm) => { fm.hero = []; }, 'hero');
  rejects((fm) => { fm.breadcrumbs = 'wrong'; }, 'breadcrumbs');
  rejects((fm) => { fm.breadcrumbs[0].path = 12; }, 'breadcrumbs.0.path');
  rejects((fm) => { fm.keyFacts[0].description = false; }, 'keyFacts.0.description');
  rejects((fm) => { fm.faq[0].a = '  '; }, 'faq.0.a');
  rejects((fm) => { fm.sources[0].url = '/not-absolute'; }, 'sources.0.url');
  rejects((fm) => { fm.author.name = null; }, 'author.name');
  rejects((fm) => { fm.schemaEntity.latitude = 100; }, 'schemaEntity.latitude');
  rejects((fm) => { fm.noindex = 'false'; }, 'noindex');
  rejects((fm) => { fm.contentLocale = 'es'; }, 'contentLocale');
});
test('all required hero variants must exist and dimensions must be positive integers', () => {
  for (const field of ['mobile', 'mobile2x', 'desktop', 'desktop2x', 'fallback']) {
    rejects((fm) => delete fm.hero[field], `hero.${field}`);
    rejects((fm) => { fm.hero[field] = '/missing.webp'; }, `hero.${field}`);
  }
  rejects((fm) => { fm.hero.og = '/missing.jpg'; }, 'hero.og');
  rejects((fm) => { fm.hero.width = 0; }, 'hero.width');
  rejects((fm) => { fm.hero.height = '960'; }, 'hero.height');
});
test('unsafe and non-file asset paths are rejected, including escaping symlinks', () => {
  for (const value of ['https://example.org/a.webp', '//host/a.webp', '/../secret.webp',
    '/%2e%2e/secret.webp', '/articles/fixture', '/articles/fixture/mobile.webp?x=1', '/bad%ZZ']) {
    rejects((fm) => { fm.hero.mobile = value; }, 'hero.mobile');
  }
  writeFileSync(path.join(temp, 'outside.webp'), 'outside');
  symlinkSync(path.join(temp, 'outside.webp'), path.join(publicDir, 'escape.webp'));
  rejects((fm) => { fm.hero.mobile = '/escape.webp'; }, 'hero.mobile');
});
test('real calendar dates and chronological ordering are enforced', () => {
  for (const value of ['2023-02-29', '2024-02-30', '2024-13-01', '2024-00-10', '2024-04-31', 'not a date']) {
    rejects((fm) => { fm.datePublished = value; }, 'datePublished');
  }
  rejects((fm) => { fm.dateModified = '2024-02-28'; }, 'dateModified');
  const fm = valid();
  fm.datePublished = new Date('2024-02-29T00:00:00Z');
  assert.deepEqual(validateFrontmatter(fm, publicDir, 'en'), []);
  assert.ok(validateFrontmatter(fm, publicDir, 'en', 'datePublished: 2024-02-30')
    .some((error) => error.startsWith('datePublished:')));
});

const source: ArticleLinkSource = { file: 'fixture.md', body: '', href: '/en/guides/fixture', legacyPath: '/guide/fixture', locale: 'en' };
const spanish = { file: 'es.md', body: '', href: '/es/guides/ejemplo', legacyPath: '/guide/es/ejemplo', locale: 'es' };
function markdown(body: string) {
  return validateArticleMarkdown({ ...source, body }, [source, spanish], 'https://example.com');
}
test('ATX and Setext H1 headings, including nested ones, are rejected', () => {
  for (const body of ['# Heading', 'Heading\n===', '> # Nested', '- # Nested', '  # Indented']) {
    assert.ok(markdown(body).some((error) => error.includes('additional H1')), body);
  }
});
test('H2, code examples, and literal hash characters are not false H1s', () => {
  for (const body of ['## Heading', 'Heading\n---', '#not-a-heading', '\\# Escaped',
    '```\n# Example\nHeading\n===\nINTERNAL-LINK:example\n```', '`INTERNAL-LINK:example`']) {
    assert.deepEqual(markdown(body), [], body);
  }
});
test('registered localized, relative and legacy article links pass', () => {
  assert.deepEqual(markdown('[a](/es/guides/ejemplo) [b](fixture#heading) [c](/guide/fixture?x=1)'), []);
  assert.deepEqual(markdown('[a](https://example.com/en/guides/fixture)'), []);
});
test('broken inline, reference-style, relative, and absolute article links fail', () => {
  for (const body of ['[a](/en/guides/missing)', '[a](missing)', '[a](/guide/es/missing)',
    '[a](https://example.com/es/guides/missing)', '[a][ref]\n\n[ref]: /en/guides/missing']) {
    assert.ok(markdown(body).some((error) => error.includes('not in the content registry')), body);
  }
});
test('external and non-article links are not mistaken for article references', () => {
  assert.deepEqual(markdown('[a](https://other.example/en/guides/missing) [b](/en/contact) [c](#section)'), []);
});
test('unresolved tokens fail in URLs and prose; known tokens must resolve to registry articles', () => {
  for (const body of ['[a](INTERNAL-LINK:missing)', '[a](INTERNAL-LINK:/tickets)', 'INTERNAL-LINK:missing']) {
    assert.ok(markdown(body).some((error) => error.includes('unresolved INTERNAL-LINK')), body);
  }
  assert.ok(markdown('[unused]: INTERNAL-LINK:missing').some((error) => error.includes('unresolved INTERNAL-LINK')));
});

test('stable references prefer a genuine localized article and preserve Markdown rendering', () => {
  const resolve = createArticleReferenceResolver([
    { id: 'fixture', category: 'guide', locale: 'en', contentLocale: 'en', href: source.href, title: 'English' },
    { id: 'fixture', category: 'guide', locale: 'es', contentLocale: 'es', href: spanish.href, title: 'Español' },
    { id: 'fixture', category: 'guide', locale: 'it', contentLocale: 'en', href: '/it/guides/fixture', title: 'English copy' },
  ]);
  assert.equal(resolve('fixture', 'it')?.href, source.href);
  assert.equal(resolve('guide/fixture', 'fr')?.href, source.href);
  assert.equal(resolve('ejemplo', 'es'), undefined);
  const links = {};
  const body = '[Inline](INTERNAL-LINK:fixture) [Reference][dest] [Ordinary](/es/contact) `INTERNAL-LINK:fixture`\n\n[dest]: INTERNAL-LINK:guide/fixture';
  assert.deepEqual(validateArticleMarkdown({ ...spanish, body }, [source, spanish], 'https://example.com', resolve, links), []);
  const $ = load(renderToStaticMarkup(createElement(ReactMarkdown, {
    children: body, urlTransform: articleLinkUrlTransform(links),
  })));
  assert.deepEqual($('a').map((_, anchor) => $(anchor).attr('href')).get(), [spanish.href, spanish.href, '/es/contact']);
  assert.equal($('code').text(), 'INTERNAL-LINK:fixture');
  assert.equal(articleLinkUrlTransform(links)('javascript:evil', 'href', { type: 'element', tagName: 'a', properties: {}, children: [] }), '');
});

test('related content renders a server-side section only when links are provided', () => {
  assert.equal(renderToStaticMarkup(createElement(RelatedContent, {})), '');
  const $ = load(renderToStaticMarkup(createElement(RelatedContent, {
    links: [{ href: spanish.href, title: 'Español', locale: 'es' }],
  })));
  assert.equal($('section h2').text(), 'Related content');
  assert.equal($('section a').attr('href'), spanish.href);
  assert.equal($('section a').attr('hreflang'), 'es');
});

test('compiler reports filename and field errors and preserves generated output on failure', () => {
  const root = path.join(temp, 'compiler');
  for (const folder of ['scripts', 'src/lib', 'src/config', 'src/content/en/guides/guide',
    'src/content/en/guides/history', 'src/content/es/guides/history']) {
    mkdirSync(path.join(root, folder), { recursive: true });
  }
  writeFileSync(path.join(root, 'package.json'), '{"type":"module"}');
  symlinkSync(path.resolve('node_modules'), path.join(root, 'node_modules'), 'dir');
  for (const file of ['tsconfig.json', 'scripts/compile-articles.ts', 'scripts/article-validation.ts',
    'scripts/article-references.ts', 'src/lib/article-policy.ts', 'src/lib/packages.ts',
    'src/lib/ticket-schema.ts', 'src/content/en/event.ts', 'src/content/en/packages.ts', 'src/config/site.ts']) {
    cpSync(path.resolve(file), path.join(root, file));
  }
  cpSync(publicDir, path.join(root, 'public'), { recursive: true });
  const source = path.join(root, 'src/content/en/guides/guide/fixture.md');
  const save = (fm: Record<string, unknown>, body: string) =>
    writeFileSync(source, `---\n${JSON.stringify(fm)}\n---\n${body}\n`);
  const require = createRequire(import.meta.url);
  const compile = () => spawnSync(process.execPath,
    [require.resolve('tsx/cli'), path.join(root, 'scripts/compile-articles.ts')],
    { cwd: root, encoding: 'utf8', timeout: 30000 });
  save(valid(), '## Valid section\n\nValid content.');
  const first = compile();
  assert.equal(first.status, 0, first.stderr);
  const output = path.join(root, 'src/data/articles/guide/fixture/en.ts');
  const before = readFileSync(output, 'utf8');
  save(valid(), '# Extra H1\n\n[Broken](/en/guides/absent)');
  const second = compile();
  assert.equal(second.status, 1);
  assert.match(second.stderr, /src\/content\/en\/guides\/guide\/fixture.md: body/);
  assert.match(second.stderr, /additional H1/);
  assert.match(second.stderr, /article is not in the content registry/);
  assert.equal(readFileSync(output, 'utf8'), before);
  const invalid = valid();
  invalid.title = '   ';
  invalid.hero.width = 'wrong';
  invalid.datePublished = '2024-02-30';
  save(invalid, '## Valid section');
  const third = compile();
  assert.equal(third.status, 1);
  for (const field of ['title', 'hero.width', 'datePublished']) {
    assert.ok(third.stderr.includes(`src/content/en/guides/guide/fixture.md: ${field}:`), third.stderr);
  }
  assert.equal(readFileSync(output, 'utf8'), before);
  save(valid(), '## Valid section\n\nValid content.');
  const destination = (locale: string, slug: string, title: string, ogLocale: string) =>
    writeFileSync(path.join(root, `src/content/${locale}/guides/history/destination.md`),
      `---\n${JSON.stringify({ ...valid(), slug, locale, title, ogLocale })}\n---\nDestination text.\n`);
  destination('en', 'destination', 'English title', 'en_US');
  destination('es', 'destino', 'Título español', 'es_ES');
  const localizedSource = path.join(root, 'src/content/es/guides/history/recommender.md');
  writeFileSync(path.join(root, 'src/content/en/guides/history/recommender.md'),
    `---\n${JSON.stringify({ ...valid(), slug: 'recommender' })}\n---\nEnglish article.\n`);
  writeFileSync(localizedSource, `---\n${JSON.stringify({
    ...valid(), slug: 'recomendador', locale: 'es', ogLocale: 'es_ES',
    relatedGuides: ['destination'], relatedArticles: ['history/destination'], relatedTours: ['castle-tickets'],
  })}\n---\n[Guide](INTERNAL-LINK:destination)\n`);
  const fourth = compile();
  assert.equal(fourth.status, 0, fourth.stderr);
  const localizedOut = path.join(root, 'src/data/articles/history/recommender/es.ts');
  const compiled = readFileSync(localizedOut, 'utf8');
  const result = JSON.parse(compiled.slice(compiled.indexOf(' = ') + 3, compiled.lastIndexOf(';', compiled.indexOf('export default'))));
  assert.equal(result.internalLinks['INTERNAL-LINK:destination'].href, '/es/guides/destino');
  assert.deepEqual(result.relatedContent.map((link: { href: string }) => link.href), ['/es/guides/destino', '/es/tours/castle-tickets']);
  assert.equal(result.relatedContent[0].title, 'Título español');
  assert.equal(result.body, '[Guide](INTERNAL-LINK:destination)');
  save({ ...valid(), relatedGuides: ['absent'], relatedArticles: ['fixture'], relatedTours: ['absent'] }, '[Bad](INTERNAL-LINK:absent)');
  const fifth = compile();
  assert.equal(fifth.status, 1);
  for (const field of ['relatedGuides.0', 'relatedArticles.0', 'relatedTours.0']) assert.ok(fifth.stderr.includes(field), fifth.stderr);
  assert.match(fifth.stderr, /unresolved INTERNAL-LINK/);
  assert.equal(readFileSync(localizedOut, 'utf8'), compiled);
});
