import { packages as en } from '@/content/en/packages';
import type { TicketType } from '@/content';
import { SITE } from '@/config/site';

/** Site data, not booking behavior: replace this catalog when reusing the core. */
export type Package = {
  slug: string;
  title: string;
  description: string;
  image: string;
  tickets: TicketType[];
  contentLocale: string;
};

// Register only real translations here. Missing content falls back explicitly.
const catalog: Record<string, Package[]> = { en };
export function getPackages(locale: string): Package[] {
  const translated = catalog[locale] ?? [];
  return [
    ...catalog.en.map((item) => translated.find((variant) => variant.slug === item.slug) ?? item),
    ...translated.filter((item) => !catalog.en.some((base) => base.slug === item.slug)),
  ];
}

export function getPackage(slug: string, locale: string) {
  return getPackages(locale).find((item) => item.slug === slug);
}

export function getDefaultPackage(locale: string) {
  const item = getPackage(SITE.defaultPackage, locale);
  if (!item) throw new Error(`SITE.defaultPackage "${SITE.defaultPackage}" is missing from the package catalog.`);
  return item;
}

export function getPackageTranslationLocales(slug: string) {
  return Object.keys(catalog).filter((locale) => catalog[locale].some((item) => item.slug === slug));
}
