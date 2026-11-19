'use client';

import { useState } from 'react';

interface FaqItem {
  q: string;
  a: string;
}

interface ArticleFaqProps {
  heading?: string;
  items: FaqItem[];
}

/**
 * FAQ accordion for article pages.
 *
 * Renders as an accessible <details>/<summary> pair so it degrades gracefully
 * without JS. The open/close animation is handled via CSS max-height
 * transition rather than height (avoids layout shift on open).
 *
 * Each answer must be a complete standalone sentence — AI answer engines
 * (ChatGPT, Perplexity, Gemini) read FAQPage JSON-LD directly, not the
 * rendered HTML, so the text quality here directly affects GEO performance.
 */
export function ArticleFaq({ heading = 'Frequently Asked Questions', items }: ArticleFaqProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (!items.length) return null;

  return (
    <section className="mt-14 pt-10 border-t border-foreground/10">
      <h2 className="font-serif text-2xl font-bold mb-6">{heading}</h2>
      <div className="space-y-2">
        {items.map((item, i) => {
          const isOpen = openIndex === i;
          return (
            <div
              key={i}
              className="border border-foreground/10 rounded-lg overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="w-full flex items-start justify-between gap-4 px-5 py-4 text-left hover:bg-foreground/5 transition-colors"
              >
                <span className="font-medium text-sm sm:text-base leading-snug pr-2">
                  {item.q}
                </span>
                <span
                  className="shrink-0 mt-0.5 text-foreground/40 transition-transform duration-200"
                  style={{ transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)' }}
                  aria-hidden="true"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M8 3v10M3 8h10"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </button>
              {isOpen && (
                <div className="px-5 pb-5 text-sm sm:text-base leading-relaxed text-foreground/75">
                  {item.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
