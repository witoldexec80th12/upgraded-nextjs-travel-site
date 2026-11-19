import type { ArticleHero as ArticleHeroType } from '@/lib/article-types';

interface ArticleHeroProps {
  hero: ArticleHeroType;
  /** Used as the visible <h1> on the page — passed here so the hero can
   *  render it overlaid on the image on large screens if desired. */
  h1?: string;
}

/**
 * Responsive hero image for article pages.
 *
 * Uses a <picture> element with two <source> tags (mobile / desktop) so the
 * browser always picks the smallest file needed for the current viewport.
 * The `fetchpriority="high"` + `loading="eager"` combination instructs the
 * browser to start this fetch as early as possible — critical for LCP.
 *
 * The SSG prerender script additionally emits `<link rel="preload" as="image"
 * imagesrcset="…">` tags in <head> (via heroPreload in SeoHeadOpts) so the
 * image starts downloading before the JS bundle is parsed.
 */
export function ArticleHero({ hero, h1 }: ArticleHeroProps) {
  return (
    <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16/9', maxHeight: '560px' }}>
      <picture className="absolute inset-0 w-full h-full">
        {/* Desktop: 1024px and wider */}
        <source
          media="(min-width: 1024px)"
          srcSet={`${hero.desktop} 1x, ${hero.desktop2x} 2x`}
          type="image/webp"
        />
        {/* Mobile: narrower than 1024px */}
        <source
          media="(max-width: 1023px)"
          srcSet={`${hero.mobile} 1x, ${hero.mobile2x} 2x`}
          type="image/webp"
        />
        {/* Fallback JPEG (also the LCP element) */}
        <img
          src={hero.fallback ?? hero.desktop}
          alt={hero.alt}
          width={hero.width}
          height={hero.height}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          style={{ objectPosition: hero.focal ?? '50% 50%' }}
          className="w-full h-full object-cover"
        />
      </picture>

      {/* Gradient overlay — ensures readable text if h1 is rendered inside */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.55) 100%)',
        }}
        aria-hidden="true"
      />
    </div>
  );
}
