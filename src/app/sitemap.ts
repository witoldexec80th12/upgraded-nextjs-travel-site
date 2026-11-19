import type { MetadataRoute } from 'next';
import { SITE } from '@/config/site';
import { getPublicPaths } from '@/lib/site-pages';
import { getPagePresentation } from '@/lib/page-metadata';

export const dynamic = 'force-static';
export default function sitemap(): MetadataRoute.Sitemap {
  return getPublicPaths().flatMap((path) => {
    const presentation = getPagePresentation(path)!;
    if (presentation.noindex) return [];
    return [{
      url: `${SITE.origin}${path}`,
      alternates: { languages: presentation.metadata.alternates?.languages as Record<string, string> },
    }];
  });
}
