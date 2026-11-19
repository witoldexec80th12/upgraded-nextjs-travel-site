interface KeyFact {
  name: string;
  description: string;
}

interface ArticleKeyFactsProps {
  facts: KeyFact[];
}

/**
 * Horizontally scrollable key-facts bar shown below the lede.
 *
 * Scannable at a glance — readers use this to quickly decide whether to read
 * the full article. Keep each fact to 1-4 words; no full sentences here
 * (save those for the FAQ and body).
 *
 * Typically 3-6 facts. More than 6 starts to lose scannability.
 */
export function ArticleKeyFacts({ facts }: ArticleKeyFactsProps) {
  if (!facts.length) return null;

  return (
    <div
      className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-1"
      aria-label="Key facts"
    >
      <dl className="inline-flex gap-6 sm:gap-8 min-w-max py-4 border-y border-foreground/10">
        {facts.map((fact) => (
          <div key={fact.name} className="flex flex-col gap-0.5 min-w-[80px]">
            <dt className="text-[11px] font-semibold tracking-widest uppercase text-foreground/40">
              {fact.name}
            </dt>
            <dd className="text-sm font-medium text-foreground/90 whitespace-nowrap">
              {fact.description}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
