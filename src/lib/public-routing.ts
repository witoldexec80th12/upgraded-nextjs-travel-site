import { SITE } from '@/config/site';
import { articleLocalePaths } from '@/lib/article-routes';

export const publicLocales = [...new Set([...SITE.supportedLocales, ...SITE.contentLocales])];

/** Handles legacy links too; query strings and fragments are preserved. */
export function localizedHref(href: string, locale: string): string {
  if (!href.startsWith('/') || href.startsWith('//') ||
      /^\/(admin|api|health)(\/|$)/.test(href)) return href;
  const boundary = href.search(/[?#]/);
  const path = boundary < 0 ? href : href.slice(0, boundary);
  const tail = boundary < 0 ? '' : href.slice(boundary);
  const articlePaths = Object.values(articleLocalePaths).find((paths) => Object.values(paths).includes(path));
  if (articlePaths) return `${articlePaths[locale] ?? articlePaths.en}${tail}`;
  const parts = path.split('/').filter(Boolean);
  const explicitLocale = publicLocales.includes(parts[0]) ? parts.shift() : undefined;
  const targetLocale = explicitLocale ?? locale;
  let suffix = parts.join('/');
  if (suffix === 'schedule') suffix = `booking/${SITE.defaultPackage}`;
  if (suffix.startsWith('article/')) suffix = suffix.replace(/^article\//, 'guides/');
  return `/${targetLocale}${suffix ? `/${suffix}` : ''}${tail}`;
}
