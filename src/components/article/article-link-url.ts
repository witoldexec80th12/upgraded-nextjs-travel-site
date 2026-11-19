import { defaultUrlTransform, type UrlTransform } from 'react-markdown';
import type { Article } from '@/lib/article-types';

/** Only compiled Markdown link destinations can expand into article URLs. */
export function articleLinkUrlTransform(links: Article['internalLinks']): UrlTransform {
  return (url, key) => {
    const target = key === 'href' && links && Object.hasOwn(links, url) ? links[url] : undefined;
    return defaultUrlTransform(target?.href ?? url);
  };
}
