/**
 * FaqPage.tsx
 *
 * Renders the /faq route from the compiled FAQ enrichment data in
 * src/data/faq/. Three outputs are served from one source file:
 *
 *  1. Grouped /faq page   — all faqGroups, H2 headings, CTAs at placement positions
 *  2. Homepage block       — priority:high items (via getHomepageFaqItems in data/faq/index.ts)
 *  3. FAQPage JSON-LD      — schema:true items, links stripped (shared metadata)
 *
 * To edit FAQ content:
 *   Edit content/faq/en.md → run `npm run faq` → done.
 */

import { getEventConfig } from '@/content';
import { PageLayout } from '@/components/layout/PageLayout';
import { getFaqData } from '@/data/faq';
import { Faq } from '@/components/article/Faq';
import type { FaqCta, FaqGroup, FaqSource } from '@/lib/faq-types';

// ── Sub-components ────────────────────────────────────────────────────────────

function CtaBlock({ cta, primary, locale = 'en' }: { cta: FaqCta; primary: boolean; locale?: string }) {
  const config = getEventConfig(locale);
  const bg  = `hsl(${config.brand.colors.primary})`;
  const fg  = `hsl(${config.brand.colors.primaryForeground})`;
  const muted = `hsl(${config.brand.colors.primary} / 0.08)`;

  return (
    <div
      className="my-8 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4"
      style={{ backgroundColor: muted }}
    >
      {primary ? (
        <>
          <p className="flex-1 text-sm text-foreground/70">
            Online advance booking is mandatory for all visits — no walk-up tickets
            are sold at the entrance.
          </p>
          <a
            href={cta.href}
            data-track="faq_cta_primary"
            className="shrink-0 rounded-xl px-6 py-3 text-sm font-bold transition-opacity hover:opacity-90"
            style={{ backgroundColor: bg, color: fg }}
          >
            {cta.label}
          </a>
        </>
      ) : (
        <a
          href={cta.href}
          data-track="faq_cta_secondary"
          className="text-sm font-semibold underline underline-offset-2 hover:opacity-70 transition-opacity"
          style={{ color: `hsl(${config.brand.colors.primary})` }}
        >
          {cta.label} →
        </a>
      )}
    </div>
  );
}

function FaqSources({ sources, locale = 'en' }: { sources: FaqSource[]; locale?: string }) {
  const config = getEventConfig(locale);
  return (
    <footer className="mt-16 pt-8 border-t border-foreground/10">
      <h2
        className="text-xs font-bold uppercase tracking-widest mb-4"
        style={{ color: `hsl(${config.brand.colors.primary})` }}
      >
        Sources
      </h2>
      <ul className="space-y-1">
        {sources.map((s, i) => (
          <li key={i} className="text-xs text-muted-foreground">
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {s.label}
            </a>
            {s.type === 'official' && (
              <span className="ml-2 text-[10px] uppercase tracking-wider opacity-60">
                official
              </span>
            )}
          </li>
        ))}
      </ul>
    </footer>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FaqPage({ locale = 'en' }: { locale?: string }) {
  const config = getEventConfig(locale);
  const faq = getFaqData(locale);

  // Breadcrumbs shown on the page; matching schema is generated on the server.
  const breadcrumbs = faq
    ? faq.breadcrumbs.map((b) => ({ name: b.name, path: b.href }))
    : [{ name: 'Home', path: '/' }, { name: 'FAQ', path: '/faq' }];

  const pageTitle       = faq?.seo.title       ?? config.faq.heading;
  const h1              = faq?.seo.ogTitle      ?? pageTitle;
  const intro           = faq?.seo.ogDescription ?? '';

  // ── Fallback: no enrichment file ────────────────────────────────────────────
  if (!faq) {
    return (
      <PageLayout>
        <div className="max-w-3xl mx-auto px-6 py-20 w-full">
          <h1
            className="font-serif text-4xl md:text-5xl font-bold mb-12"
            style={{ color: `hsl(${config.brand.colors.primary})` }}
          >
            {config.faq.heading}
          </h1>
          <p className="text-muted-foreground mb-8">{config.faq.mandatoryNote}</p>
          <div className="space-y-4">
            {config.faq.items.map((item, i) => (
              <div key={i} className="p-6 rounded-2xl bg-card border shadow-sm">
                <h2 className="text-lg font-bold mb-3">{item.q}</h2>
                <p className="text-muted-foreground leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </PageLayout>
    );
  }

  const { faqGroups, ctas, sources } = faq;
  const primaryCta   = ctas?.primary;
  const secondaryCta = ctas?.secondary;

  const ctaAfterGroup = (group: FaqGroup) =>
    primaryCta?.placement === `after-${group.id}` ? primaryCta : null;

  return (
    <PageLayout>
      <div className="max-w-3xl mx-auto px-6 py-20 w-full">

        {/* Page header */}
        <header className="mb-12">
          <h1
            className="font-serif text-4xl md:text-5xl font-bold mb-4"
            style={{ color: `hsl(${config.brand.colors.primary})` }}
          >
            {h1}
          </h1>
          {intro && (
            <p className="text-lg text-muted-foreground leading-relaxed">{intro}</p>
          )}
        </header>

        {/* FAQ groups */}
        {faqGroups.map((group) => (
          <section key={group.id} id={group.id} className="mb-10">
            <h2
              className="font-serif text-2xl font-bold mb-5"
              style={{ color: `hsl(${config.brand.colors.primary})` }}
            >
              {group.name}
            </h2>

            {/* Accordion — reuses the existing accessible Faq component */}
            <Faq items={group.items} />

            {/* CTA after this group if placement matches */}
            {ctaAfterGroup(group) && (
              <CtaBlock cta={ctaAfterGroup(group)!} primary locale={locale} />
            )}
          </section>
        ))}

        {/* End CTA */}
        {secondaryCta?.placement === 'end' && (
          <CtaBlock cta={secondaryCta} primary={false} locale={locale} />
        )}

        {/* Sources */}
        {sources?.length ? <FaqSources sources={sources} locale={locale} /> : null}

      </div>
    </PageLayout>
  );
}
