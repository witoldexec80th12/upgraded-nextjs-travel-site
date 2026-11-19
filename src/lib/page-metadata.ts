import type { Metadata } from 'next';
import { SITE } from '@/config/site';
import { getEventConfig, getEventContentLocale } from '@/content';
import { getFaqData, getFaqSchemaItems } from '@/data/faq';
import { buildArticleJsonLd, buildTicketJsonLd } from '@/lib/schema';
import { getMessages, translate } from '@/i18n/messages';
import { resolveSitePage, standardRoutes } from '@/lib/site-pages';
import { getPackageTranslationLocales, getDefaultPackage } from '@/lib/packages';
import {
  absoluteAsset, absoluteUrl, buildJsonLdGraph, getHreflangLinks,
  getMetaDescription, openGraphLocale, type Breadcrumb,
} from '@/lib/seo';

export function getPagePresentation(path: string) {
  const page = resolveSitePage(path);
  if (!page) return null;
  const { locale, contentPath, article } = page;
  const tourPackage = 'tourPackage' in page ? page.tourPackage : undefined;
  const contentLocale = article?.contentLocale ?? tourPackage?.contentLocale ?? getEventContentLocale(locale);
  const isFallback = contentLocale !== locale;
  const config = getEventConfig(locale);
  const legacyArticle = config.discoverArticles.find((item) => contentPath === `/article/${item.slug}`);
  const t = (key: string) => translate(getMessages(locale), key);
  const faq = getFaqData(locale);
  const titles: Record<string, string> = {
    '/': config.hero.title,
    '/faq': faq?.seo.title ?? config.faq.heading,
    '/activities': config.activities.heading,
    '/contact': config.contact.heading,
    '/schedule': t('schedule.title'),
    '/success': 'Booking Confirmed',
    '/terms': 'Terms & Conditions',
    '/privacy': 'Privacy Policy',
    '/cookies': 'Cookie Policy',
  };
  const fallbacks: Record<string, string> = {
    '/': config.hero.subtitle,
    '/faq': faq?.seo.metaDescription ?? config.faq.mandatoryNote,
    '/activities': config.activities.subtitle,
    '/contact': config.contact.description[0],
    '/schedule': config.hero.subtitle,
    '/success': `Booking confirmation for ${config.brand.name}.`,
  };
  const title = article?.title ?? `${legacyArticle?.title ?? (contentPath.startsWith('/tours/') ? tourPackage?.title : undefined) ?? titles[contentPath]}${SITE.metadata.titleSeparator}${config.brand.name}`;
  const descriptionKeys: Record<string, Parameters<typeof getMetaDescription>[1]> = {
    '/': 'home', '/schedule': 'schedule', '/faq': 'faq', '/activities': 'activities',
    '/contact': 'contact', '/terms': 'terms', '/privacy': 'privacy', '/cookies': 'cookies',
  };
  const fallback = legacyArticle?.excerpt ?? tourPackage?.description ?? fallbacks[contentPath] ?? `${titles[contentPath]} for ${config.brand.name}.`;
  const description = article?.metaDescription ??
    (contentPath === '/faq' && faq ? faq.seo.metaDescription :
      descriptionKeys[contentPath] ? getMetaDescription(config, descriptionKeys[contentPath], fallback) : fallback);
  const noindex = isFallback || article?.noindex || (standardRoutes.find((route) => route.path === contentPath)?.noindex ?? false);
  const routeSuffix = path.slice(locale.length + 1) || '/';
  const canonical = article ? `${SITE.origin}${article.canonicalPath}` : absoluteUrl(config, contentLocale, routeSuffix);
  const alternates = isFallback ? [] : article
    ? [...article.alternateRoutes.map((alt) => ({ hreflang: alt.locale, href: `${SITE.origin}${alt.path}` })),
      ...article.alternateRoutes.filter((alt) => alt.locale === 'en')
        .map((alt) => ({ hreflang: 'x-default', href: `${SITE.origin}${alt.path}` }))]
    : tourPackage ? [
      ...getPackageTranslationLocales(tourPackage.slug).map((lang) => ({ hreflang: lang, href: absoluteUrl(config, lang, routeSuffix) })),
      { hreflang: 'x-default', href: absoluteUrl(config, 'en', routeSuffix) },
    ] : getHreflangLinks(config, routeSuffix);
  const image = absoluteAsset(config, article ? article.hero.og ?? article.hero.desktop : config.hero.heroImage);
  const metadata: Metadata = {
    title: { absolute: title },
    description,
    alternates: { canonical, languages: Object.fromEntries(alternates.map((alt) => [alt.hreflang, alt.href])) },
    robots: { index: !noindex, follow: !noindex },
    openGraph: {
      title, description, url: canonical, siteName: config.brand.name, images: [image],
       locale: isFallback ? openGraphLocale(contentLocale) : article?.ogLocale ?? openGraphLocale(contentLocale),
      alternateLocale: isFallback ? [] : article
        ? article.alternateRoutes.filter((alt) => alt.locale !== locale).map((alt) => alt.ogLocale)
         : alternates.filter((alt) => alt.hreflang !== 'x-default' && alt.hreflang !== contentLocale).map((alt) => openGraphLocale(alt.hreflang)),
      ...(article ? { type: 'article', publishedTime: article.datePublished, modifiedTime: article.dateModified } :
        { type: 'website' }),
    },
    twitter: { card: SITE.metadata.twitterCard, title, description, images: [image] },
  };
  const breadcrumbs: Breadcrumb[] = [
    { name: 'Home', path: '/' },
    ...(contentPath === '/' ? [] : [{ name: tourPackage?.title ?? titles[contentPath] ?? legacyArticle?.title ?? 'Article', path: routeSuffix }]),
  ];
  const faqItems = contentPath === '/faq' ? getFaqSchemaItems(locale) : undefined;
  const jsonLd = article ? buildArticleJsonLd(article, config) :
    [buildJsonLdGraph(config, contentLocale, {
      breadcrumbs,
      faqItems: faqItems?.length ? faqItems : contentPath === '/faq' ? config.faq.items : undefined,
    }), ...(contentPath === '/' ? [buildTicketJsonLd({ ...config, ticketTypes: getDefaultPackage(locale).tickets })] : [])];
  return { page, metadata, jsonLd, contentLocale, isFallback, noindex };
}
