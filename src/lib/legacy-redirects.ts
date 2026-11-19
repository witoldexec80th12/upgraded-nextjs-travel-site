import { SITE } from '../config/site';
import { legacyArticleRedirects } from './article-routes';
import { getEventConfig } from '../content';

/** Finite mappings avoid swallowing /admin, /api, or unknown routes. */
export function getLegacyRedirects() {
  const locales = [...new Set([...SITE.supportedLocales, ...SITE.contentLocales])];
  const pages = ['', '/faq', '/activities', '/contact', '/terms', '/privacy', '/cookies', '/success'];
  const redirects = pages.map((path) => ({
    source: path || '/', destination: `/${SITE.defaultLanguage}${path}`, permanent: true,
  }));
  for (const locale of ['', ...locales]) {
    const prefix = locale ? `/${locale}` : '';
    const target = locale || SITE.defaultLanguage;
    redirects.push({
      source: `${prefix}/schedule`, destination: `/${target}/booking/${SITE.defaultPackage}`, permanent: true,
    });
    // Existing config article identifiers, kept as a compatibility contract.
    for (const { slug } of getEventConfig(target).discoverArticles) {
      redirects.push({ source: `${prefix}/article/${slug}`, destination: `/${target}/guides/${slug}`, permanent: true });
    }
  }
  return [...redirects, ...legacyArticleRedirects];
}
