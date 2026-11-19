// Only the text discovery file is generated. Next owns sitemap.xml/robots.txt.
import { writeFileSync } from 'node:fs';
import { SITE } from '../src/config/site';
import { getPublicPaths } from '../src/lib/site-pages';
import { getPagePresentation } from '../src/lib/page-metadata';

const paths = getPublicPaths().filter((path) => {
  const page = getPagePresentation(path)!;
  return !page.noindex && page.page.locale === SITE.defaultLanguage;
});
writeFileSync('public/llms.txt', `# ${SITE.brandName}

Public content uses locale-prefixed URLs. Some locales provide translated
navigation only, with explicitly marked English content fallbacks.
Only genuine content translations are advertised as language alternates.
Booking is a demo; no real payments are taken.

## Key pages
${paths.map((path) => `- ${SITE.origin}${path}`).join('\n')}
`);
console.log('[seo] generated public/llms.txt; Next metadata routes own sitemap and robots');
