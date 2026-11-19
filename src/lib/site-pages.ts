import { SITE } from '@/config/site';
import { getEventConfig } from '@/content';
import { ARTICLES, getArticleByPath } from '@/data/articles';
import { publicLocales } from '@/lib/public-routing';
import { getPackages } from '@/lib/packages';

export const standardRoutes = [
  { path: '/', key: 'home' },
  { path: '/schedule', key: 'schedule', noindex: true },
  { path: '/success', key: 'success', noindex: true },
  ...['faq', 'activities', 'contact', 'terms', 'privacy', 'cookies'].map((key) => ({ path: `/${key}`, key })),
  ...getEventConfig('en').discoverArticles.map((article) => ({ path: `/article/${article.slug}`, key: article.id })),
];

/** Article locale is embedded after its category, not before it. */
export function resolveSitePage(path: string) {
  const article = getArticleByPath(path);
  if (article) return { path, contentPath: path, locale: article.locale, article, tourPackage: undefined };
  const parts = path.split('/').filter(Boolean);
  const locale = parts.shift()!;
  if (!publicLocales.includes(locale)) return null;
  let contentPath = `/${parts.join('/')}`;
  let tourPackage;
  if (parts.length === 2 && ['tours', 'booking'].includes(parts[0])) {
    tourPackage = getPackages(locale).find((item) => item.slug === parts[1]);
    if (!tourPackage) return null;
    contentPath = parts[0] === 'booking' ? '/schedule' : `/tours/${tourPackage.slug}`;
  }
  if (parts[0] === 'guides' && parts.length === 2) contentPath = `/article/${parts[1]}`;
  if (tourPackage) return { path, contentPath, locale, article: undefined, tourPackage };
  if (!standardRoutes.some((route) => route.path === contentPath)) return null;
  // Old schedule and article paths are redirects, not live duplicate pages.
  if (parts[0] === 'schedule' || parts[0] === 'article') return null;
  return { path, contentPath, locale, article: undefined, tourPackage: undefined };
}

export function getPublicPaths(): string[] {
  const basePaths = standardRoutes.filter((route) => route.path !== '/schedule' && !route.path.startsWith('/article/')).flatMap((route) =>
    publicLocales.map((locale) => `/${locale}${route.path === '/' ? '' : route.path}`),
  );
  const dataPaths = publicLocales.flatMap((locale) => [
    ...getPackages(locale).flatMap((item) => [`/${locale}/tours/${item.slug}`, `/${locale}/booking/${item.slug}`]),
    ...getEventConfig(locale).discoverArticles.map((item) => `/${locale}/guides/${item.slug}`),
  ]);
  return [...new Set([...basePaths, ...dataPaths, ...ARTICLES.map((article) => article.href)])];
}

export function getThemeCss(locale: string) {
  const { brand } = getEventConfig(locale);
  const c = brand.colors;
  return `:root {
    --background: ${c.background}; --foreground: ${c.foreground};
    --primary: ${c.primary}; --primary-foreground: ${c.primaryForeground};
    --accent: ${c.accent};
    --app-font-sans: ${brand.fontSans}; --app-font-serif: ${brand.fontSerif};
  }`;
}
