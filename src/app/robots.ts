import type { MetadataRoute } from 'next';
import { SITE } from '@/config/site';
import { publicLocales } from '@/lib/public-routing';

export const dynamic = 'force-static';
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*', allow: '/',
      disallow: ['/admin', '/api/', '/health', '/success', '/schedule',
        ...publicLocales.flatMap((locale) => [`/${locale}/success`, `/${locale}/booking/`])],
    },
    sitemap: `${SITE.origin}/sitemap.xml`,
  };
}
