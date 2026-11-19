import assert from 'node:assert/strict';
import { auditPublicLinks, type LinkPage } from './foundation-links';

/** Regression fixtures run inside test:foundation; no extra command or server. */
export async function testLinkCrawler() {
  const origin = 'https://foundation.invalid';
  const seen: string[] = [];
  const html = (body: string): LinkPage => ({
    status: 200, contentType: 'text/html; charset=utf-8', html: `<!doctype html><html><body>${body}</body></html>`,
  });
  const home = html(`
    <div id="tickets"></div>
    <a href="#tickets">Local tickets</a>
    <a href="/en/tours/good#included">Tour</a>
    <a href="/en/tours/missing">Missing tour</a>
    <a href="/en/guides/existing#missing">Missing section</a>
    <a href="/old#included">Old tour URL</a>
    <a href="/de/guides/existing#encoded%20id">Unmarked language switch</a>
    <a href="/de/guides/existing" hreflang="de">Intentional language switch</a>
    <a href="//foundation.invalid/en/faq?from=home#answer">FAQ query</a>
    <a href="/en/booking/package?session=incomplete&amp;adults=0">Incomplete booking</a>
    <a href="/en/booking/missing?session=incomplete">Missing booking package</a>
    <a href="/loop-a">Loop</a><a href="/bad-location">No Location</a>
    <a href="/private-redirect">Private redirect</a>
    <a href="/external-redirect">External redirect</a>
    <a href="INTERNAL-LINK:unknown">Unresolved token</a>
    <nav aria-label="Breadcrumb"><a href="/en/missing-breadcrumb">Visible crumb</a></nav>
    <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{
      "@type":"BreadcrumbList","itemListElement":[
        {"name":"Schema crumb","item":{"@id":"${origin}/en/schema-missing"}},
        {"name":"Current page"}]}]}</script>
    <a href="/api/must-not-request">API</a><a href="/admin">Admin</a>
    <a href="/health">Health</a><a href="https://external.invalid/page">External</a>
    <a href="mailto:test@example.com">Email</a><a href="tel:123">Phone</a>
    <a href="javascript:void(0)">Action</a><a href="#">Placeholder</a>
    <a href="">Empty</a><a href="/download" download>Download</a>
    <a href="/file.pdf">PDF</a><a href="#:~:text=sample">Text fragment</a>
    <template><a href="/template-only">Not rendered</a></template>
  `);
  const responses: Record<string, LinkPage> = {
    '/en': home,
    '/en/tours/good': html('<h1>Tour</h1><section id="included">Included</section>'),
    '/en/guides/existing': html('<h1>Guide</h1>'),
    '/de/guides/existing': html('<h1>Artikel</h1><div id="encoded id"></div>'),
    '/en/faq?from=home': html('<div id="answer">Answer</div>'),
    '/en/booking/package': html('<p>No selection yet. Choose tickets.</p>'),
    '/old': { status: 308, location: '/en/tours/good', html: '', contentType: '' },
    '/loop-a': { status: 302, location: '/loop-b', html: '', contentType: '' },
    '/loop-b': { status: 302, location: '/loop-a', html: '', contentType: '' },
    '/bad-location': { status: 307, html: '', contentType: '' },
    '/private-redirect': { status: 302, location: '/api/must-not-request', html: '', contentType: '' },
    '/external-redirect': { status: 302, location: 'https://external.invalid/checkout', html: '', contentType: '' },
  };
  const report = await auditPublicLinks({
    base: 'http://127.0.0.1:9999', origin, paths: ['/en', '/de/guides/existing', '/en/booking/package', '/en/privacy'],
    locales: ['en', 'de'], redirects: [{ source: '/old', destination: '/en/tours/good' }],
  }, async (path) => {
    seen.push(path);
    if (path === '/en/privacy') return html('<h1>Unlinked informational page</h1>');
    return responses[path] ?? { status: 404, html: '<h1>Not found</h1>', contentType: 'text/html' };
  });
  const findings = (text: string) => report.issues.filter((item) => item.linkText === text);
  assert.equal(report.pages, 4, 'Every registered page must be fetched');
  assert.ok(seen.includes('/en/privacy'), 'Crawl registered pages even when no other page links to them');
  assert.equal(findings('Tour').length, 0);
  assert.equal(findings('Local tickets').length, 0);
  assert.equal(findings('FAQ query').length, 0);
  assert.equal(findings('Incomplete booking').length, 0);
  assert.equal(findings('Intentional language switch').length, 0);
  assert.equal(findings('Unmarked language switch')[0]?.kind, 'language-mismatch');
  assert.equal(findings('Missing tour')[0]?.severity, 'error');
  assert.equal(findings('Missing booking package')[0]?.severity, 'error');
  assert.equal(findings('Missing section')[0]?.kind, 'missing-fragment');
  assert.equal(findings('Visible crumb')[0]?.context, 'HTML breadcrumb');
  assert.equal(findings('Schema crumb')[0]?.context, 'JSON-LD breadcrumb');
  assert.equal(findings('Old tour URL')[0]?.kind, 'redirect');
  assert.equal(findings('Old tour URL').length, 1, 'Redirect must preserve the valid fragment');
  assert.match(findings('Loop')[0]?.detail ?? '', /Redirect loop/);
  assert.match(findings('No Location')[0]?.detail ?? '', /Location/);
  assert.match(findings('Private redirect')[0]?.detail ?? '', /excluded/);
  assert.equal(findings('External redirect')[0]?.kind, 'external-redirect');
  assert.equal(findings('Unresolved token')[0]?.kind, 'invalid-url');
  assert.equal(seen.filter((path) => path === '/en/booking/package').length, 1, 'Cache booking route without session parameters');
  assert.ok(!seen.some((path) => /api|admin|health|template-only|download|file\.pdf|session=/.test(path)), JSON.stringify(seen));
  assert.ok(report.issues.every((item) => item.destinationUrl && item.linkText && item.source && item.detail));
  assert.ok(report.issues.every((item) => item.sourceUrl));
}
