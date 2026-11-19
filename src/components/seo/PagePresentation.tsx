import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getPagePresentation } from '@/lib/page-metadata';
import { StructuredData } from './StructuredData';

export function PagePresentation({ path, children }: { path: string; children: ReactNode }) {
  const presentation = getPagePresentation(path);
  if (!presentation) notFound();
  return <>
    <StructuredData nodes={presentation.jsonLd} />
    {presentation.isFallback && <p lang="en" className="text-center text-xs bg-muted px-4 py-2">
      Page content is currently available in English. Navigation and booking controls use your selected language where available.
    </p>}
    <div lang={presentation.contentLocale}>{children}</div>
  </>;
}
