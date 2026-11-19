import { localizedHref } from '@/lib/public-routing';

/**
 * Keep site navigation localized when it starts from an article route.
 * Article-only locales without a translated site UI fall back to English.
 */
export function getSiteNavigationTarget(
  currentPath: string,
  href: string,
  locale: string,
): { href: string; useFullNavigation: boolean } {
  return { href: localizedHref(href, locale), useFullNavigation: false };
}
