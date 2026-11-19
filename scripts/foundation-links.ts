import { load } from 'cheerio';

export type LinkIssue = {
  severity: 'error' | 'warning';
  kind: string;
  sourceUrl: string | null;
  source: string;
  destinationUrl: string;
  linkText: string;
  context: string;
  detail: string;
};
export type LinkPage = { status: number; html: string; contentType: string; location?: string };
export type LinkAuditOptions = {
  base: string;
  origin: string;
  paths: string[];
  locales: readonly string[];
  redirects: { source: string; destination: string }[];
};
export type LinkReport = {
  pages: number;
  links: number;
  destinations: number;
  skipped: number;
  bookingPolicy: string;
  issues: LinkIssue[];
};
type Reference = {
  href: string; text: string; context: string; intentionalLanguage?: string;
};
const redirectStatuses = new Set([301, 302, 303, 307, 308]);
const excludedEndpoint = /^\/(?:api|admin|auth|health|_next|\.well-known)(?:\/|$)/;
const assetPath = /\.(?:pdf|zip|csv|xml|json|txt|png|jpe?g|webp|avif|gif|svg|ico|css|m?js|woff2?|ttf|mp[34]|webm|ics)$/i;
const cleanText = (text: string) => text.replace(/\s+/gu, ' ').trim();
const bookingPath = /^\/[^/]+\/booking\/[^/]+\/?$/;

function references(html: string): { links: Reference[]; invalidJson: string[]; ids: Set<string> } {
  const $ = load(html);
  // parse5 represents template contents with a document-fragment boundary,
  // so ancestor selectors alone cannot reliably exclude those descendants.
  $('template, noscript').remove();
  const links: Reference[] = [];
  const invalidJson: string[] = [];
  $('a[href]').each((_, node) => {
    const a = $(node);
    if (a.attr('download') !== undefined || a.attr('aria-disabled') === 'true' ||
        a.parents('template, noscript').length) return;
    const breadcrumb = a.parents('nav').toArray().some((nav) =>
      /breadcrumb/i.test($(nav).attr('aria-label') ?? '') || $(nav).is('[data-breadcrumb]'));
    links.push({
      href: a.attr('href') ?? '',
      text: cleanText(a.text()) || a.attr('aria-label') || a.find('img').attr('alt') || '(unlabelled link)',
      context: breadcrumb ? 'HTML breadcrumb' : 'HTML anchor',
      intentionalLanguage: a.attr('hreflang'),
    });
  });
  function walk(value: unknown) {
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (!value || typeof value !== 'object') return;
    const node = value as Record<string, unknown>;
    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    if (types.includes('BreadcrumbList') && Array.isArray(node.itemListElement)) {
      for (const item of node.itemListElement) {
        if (!item || typeof item !== 'object') continue;
        const entry = item as Record<string, unknown>;
        const target = entry.item;
        const url = typeof target === 'string' ? target :
          target && typeof target === 'object'
            ? ((target as Record<string, unknown>)['@id'] ?? (target as Record<string, unknown>).url) : undefined;
        // Omitting item on the final/current breadcrumb is valid JSON-LD.
        if (typeof url === 'string') links.push({
          href: url, text: typeof entry.name === 'string' ? entry.name : '(unnamed breadcrumb)',
          context: 'JSON-LD breadcrumb',
        });
      }
    }
    Object.values(node).forEach(walk);
  }
  $('script[type="application/ld+json"]').each((index, script) => {
    try { walk(JSON.parse($(script).text())); }
    catch (error) { invalidJson.push(`JSON-LD script ${index}: ${String(error)}`); }
  });
  return {
    links, invalidJson,
    ids: new Set($('[id]').toArray().filter((node) => !$(node).parents('template').length)
      .map((node) => $(node).attr('id')!)),
  };
}

/** Only HTTP GETs to the temporary production origin; never follows external URLs. */
export async function auditPublicLinks(
  options: LinkAuditOptions,
  request: (path: string) => Promise<LinkPage> = async (path) => {
    // Concatenate the trusted origin so a pathname beginning with "//" cannot
    // be reinterpreted as a protocol-relative request to another host.
    const response = await fetch(`${new URL(options.base).origin}${path}`, {
      redirect: 'manual', signal: AbortSignal.timeout(15000),
      headers: { Accept: 'text/html', 'User-Agent': 'Foundation-Link-Test/1.0' },
    });
    return {
      status: response.status, html: await response.text(),
      contentType: response.headers.get('content-type') ?? '',
      location: response.headers.get('location') ?? undefined,
    };
  },
): Promise<LinkReport> {
  const origin = new URL(options.origin).origin;
  const base = new URL(options.base).origin;
  const internalOrigins = new Set([origin, base]);
  const report: LinkReport = {
    pages: 0, links: 0, destinations: 0, skipped: 0, issues: [],
    bookingPolicy: 'Validate registered booking routes without selection/session query parameters. No purchase, session, availability, or API requests are performed.',
  };
  const cache = new Map<string, Promise<LinkPage>>();
  const parsed = new Map<string, ReturnType<typeof references>>();
  const issueKeys = new Set<string>();
  const language = (url: URL) => {
    const first = url.pathname.split('/')[1];
    return options.locales.includes(first) ? first : undefined;
  };
  function add(issue: LinkIssue) {
    const key = JSON.stringify(issue);
    if (!issueKeys.has(key)) { issueKeys.add(key); report.issues.push(issue); }
  }
  function internal(href: string, source: URL): URL | null {
    const trimmed = href.trim();
    if (!trimmed || trimmed === '#' || trimmed === '#!' || trimmed.startsWith('#:~:')) return null;
    if (trimmed.includes('INTERNAL-LINK:')) throw new Error('Unresolved INTERNAL-LINK token in rendered href');
    const url = new URL(trimmed, source);
    if (!['http:', 'https:'].includes(url.protocol) || !internalOrigins.has(url.origin)) return null;
    if (excludedEndpoint.test(url.pathname) || assetPath.test(url.pathname)) return null;
    // Never make authenticated requests supplied through userinfo.
    if (url.username || url.password) throw new Error('Internal URL must not contain credentials');
    url.protocol = new URL(origin).protocol;
    url.host = new URL(origin).host;
    return url;
  }
  function get(url: URL) {
    // Booking completeness is not route validity. Never require dates, ticket
    // quantities, a session token, or a checkout API to validate its URL.
    const key = url.pathname + (bookingPath.test(url.pathname) ? '' : url.search);
    if (!cache.has(key)) cache.set(key, request(key));
    return cache.get(key)!;
  }
  function parse(url: URL, page: LinkPage) {
    const key = url.pathname + (bookingPath.test(url.pathname) ? '' : url.search);
    if (!parsed.has(key)) parsed.set(key, references(page.html));
    return parsed.get(key)!;
  }
  async function resolve(target: URL) {
    let url = new URL(target);
    const visited = new Set<string>();
    const chain: string[] = [];
    for (let hop = 0; hop <= 10; hop++) {
      const key = url.pathname + url.search;
      if (visited.has(key)) throw new Error(`Redirect loop: ${[...chain, url.href].join(' → ')}`);
      visited.add(key);
      const page = await get(url);
      if (!redirectStatuses.has(page.status)) return { url, page, chain, external: false };
      if (!page.location) throw new Error(`HTTP ${page.status} redirect has no Location header`);
      chain.push(url.href);
      const next = new URL(page.location, url);
      if (!['http:', 'https:'].includes(next.protocol)) throw new Error('Redirect uses a non-HTTP(S) protocol');
      if (!internalOrigins.has(next.origin)) return { url: next, page, chain, external: true };
      if (excludedEndpoint.test(next.pathname)) throw new Error(`Public link redirects to excluded/private endpoint ${next.pathname}`);
      if (next.username || next.password) throw new Error('Redirect URL contains credentials');
      // Browsers inherit the original fragment when Location supplies none.
      if (!page.location.includes('#')) next.hash = url.hash;
      next.protocol = new URL(origin).protocol;
      next.host = new URL(origin).host;
      url = next;
    }
    throw new Error('More than 10 redirects');
  }
  async function check(ref: Reference, sourceUrl: string, documentUrl: string) {
    const source = sourceUrl;
    let target: URL | null;
    try { target = internal(ref.href, new URL(documentUrl)); }
    catch (error) {
      add({ severity: 'error', kind: 'invalid-url', sourceUrl, source, destinationUrl: ref.href,
        linkText: ref.text, context: ref.context, detail: String(error) });
      return;
    }
    if (!target) { report.skipped++; return; }
    report.links++;
    const common = { sourceUrl, source, destinationUrl: target.href, linkText: ref.text, context: ref.context };
    try {
      const result = await resolve(target);
      if (result.external) {
        add({ ...common, severity: 'warning', kind: 'external-redirect',
          detail: `Internal link redirects off-site to ${result.url.href}; external site was not requested.` });
        return;
      }
      if (result.page.status !== 200) {
        add({ ...common, severity: 'error', kind: 'broken-destination',
          detail: `HTTP ${result.page.status} at ${result.url.href}${result.chain.length ? ` after ${result.chain.length} redirect(s)` : ''}` });
        return;
      }
      if (!result.page.contentType.includes('text/html')) {
        add({ ...common, severity: 'error', kind: 'non-page-destination',
          detail: `Expected an HTML page, received ${result.page.contentType || '(no Content-Type)'}` });
        return;
      }
      if (result.chain.length) {
        const registered = options.redirects.some((item) => item.source === target.pathname);
        add({ ...common, severity: 'warning', kind: 'redirect',
          detail: `${registered ? 'Registered compatibility' : 'Unregistered or normalization'} redirect to ${result.url.href}; prefer the final URL.` });
      }
      const sourceLanguage = language(new URL(sourceUrl));
      const targetLanguage = language(result.url);
      if (sourceLanguage && targetLanguage && sourceLanguage !== targetLanguage &&
          ref.intentionalLanguage !== 'x-default' &&
          ref.intentionalLanguage?.toLowerCase() !== targetLanguage.toLowerCase()) {
        add({ ...common, severity: 'warning', kind: 'language-mismatch',
          detail: `Potential unintended language change: ${sourceLanguage} → ${targetLanguage} (${result.url.href}). No matching hreflang declares an intentional switch.` });
      }
      const fragment = result.url.hash.slice(1).split(':~:')[0];
      if (fragment) {
        const id = decodeURIComponent(fragment);
        if (!parse(result.url, result.page).ids.has(id)) {
          add({ ...common, severity: 'error', kind: 'missing-fragment',
            detail: `No element with id=${JSON.stringify(id)} in initial HTML at ${result.url.origin}${result.url.pathname}` });
        }
      }
    } catch (error) {
      add({ ...common, severity: 'error', kind: 'request-or-redirect',
        detail: String(error) });
    }
  }
  // Enumerate the registry, not merely the subset reachable from the homepage.
  for (const path of options.paths) {
    const sourceUrl = new URL(path, origin).href;
    report.pages++;
    try {
      const result = await resolve(new URL(sourceUrl));
      if (result.external || result.page.status !== 200 || !result.page.contentType.includes('text/html')) {
        add({ severity: 'error', kind: 'registered-page', sourceUrl, source: sourceUrl,
          destinationUrl: result.url.href, linkText: '(registered public page)', context: 'page registry',
          detail: `Expected an internal HTML page with HTTP 200, received HTTP ${result.page.status}` });
        continue;
      }
      const document = parse(result.url, result.page);
      for (const detail of document.invalidJson) add({
        severity: 'error', kind: 'breadcrumb-json', sourceUrl, source: sourceUrl,
        destinationUrl: sourceUrl, linkText: '(JSON-LD)', context: 'JSON-LD breadcrumb', detail,
      });
      for (const ref of document.links) await check(ref, sourceUrl, result.url.href);
    } catch (error) {
      add({ severity: 'error', kind: 'registered-page', sourceUrl, source: sourceUrl,
        destinationUrl: sourceUrl, linkText: '(registered public page)', context: 'page registry', detail: String(error) });
    }
  }
  report.destinations = cache.size;
  report.issues.sort((a, b) => a.severity.localeCompare(b.severity) || a.kind.localeCompare(b.kind) ||
    a.source.localeCompare(b.source) || a.destinationUrl.localeCompare(b.destinationUrl));
  return report;
}
