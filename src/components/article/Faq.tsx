/**
 * Faq.tsx — native <details> FAQ accordion for article pages.
 *
 * Uses the HTML <details name="faq"> attribute (exclusive accordion behaviour
 * in modern browsers) so only one item is open at a time without JS.
 * FAQ item text must match the FAQPage JSON-LD text exactly.
 */

import ReactMarkdown from 'react-markdown';
import type { ArticleFaqItem } from '@/lib/article-types';

type Props = {
  heading?: string;
  items: ArticleFaqItem[];
};

export function Faq({ heading, items }: Props) {
  if (!items.length) return null;

  return (
    <section className="faq mt-12 border-t border-foreground/20 pt-8">
      {heading && (
        <h2 className="faq__h2 font-display text-xl font-bold uppercase tracking-widest mb-6">
          {heading}
        </h2>
      )}
      <div className="space-y-2">
        {items.map((item, i) => (
          <details key={i} name="faq" className="faq-item group border border-foreground/20 rounded-lg">
            <summary className="faq-item__q flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-base font-semibold select-none list-none">
              <span>{item.q}</span>
              <svg
                className="faq-item__icon h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="faq-item__a px-5 pb-5 text-sm leading-relaxed text-foreground/80">
              <ReactMarkdown>{item.a}</ReactMarkdown>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
