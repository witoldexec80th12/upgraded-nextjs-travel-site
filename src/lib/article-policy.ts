/** Shared compiler policy; language is editorial metadata, not guessed from text. */
export type ArticleVariant = {
  locale: string;
  href: string;
  ogLocale: string;
  contentLocale: string;
  noindex: boolean;
};

export function articlePolicy(variant: ArticleVariant, variants: ArticleVariant[]) {
  const english = variants.find((item) => item.locale === 'en');
  if (!english) throw new Error('Article group requires an English original.');
  const isFallback = variant.contentLocale !== variant.locale;
  return {
    englishPath: english.href,
    canonicalPath: isFallback ? english.href : variant.href,
    contentLocale: variant.contentLocale,
    noindex: isFallback || variant.noindex,
    alternateRoutes: variants
      .filter((item) => !item.noindex && item.contentLocale === item.locale)
      .map(({ locale, href, ogLocale }) => ({ locale, path: href, ogLocale })),
  };
}
