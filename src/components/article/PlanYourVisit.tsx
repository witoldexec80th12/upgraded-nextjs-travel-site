/**
 * PlanYourVisit.tsx — article cross-link cluster.
 *
 * Appears at the bottom of every article page above the footer.
 * Builds internal PageRank and keeps users on the site.
 * data-track per convention: faq_cross_link_{slug}
 */

const ARTICLE_CROSS_LINKS = [
  {
    href: '/queen-marie-bran-castle',
    icon: '👑',
    title: 'Queen Marie & Bran',
    desc: 'How a British-born queen turned a medieval fortress into her fairy-tale home.',
  },
  {
    href: '/history-of-bran-castle',
    icon: '🏰',
    title: 'Six Centuries of History',
    desc: 'From the 1377 royal charter to the landmark it is today.',
  },
  {
    href: '/dracula-bran-castle',
    icon: '🐉',
    title: 'The Dracula Connection',
    desc: "The myth, the history, and what really connects Bran to Stoker's legend.",
  },
];

type Props = {
  /** Slug of the current article — excluded from the link list. */
  currentSlug: string;
  /** Keep this Bran-specific link cluster off unrelated imported articles. */
  articleCanonicalPath: string;
};

export function PlanYourVisit({ currentSlug, articleCanonicalPath }: Props) {
  if (articleCanonicalPath !== '/history/queen-marie-bran-castle') return null;

  const links = ARTICLE_CROSS_LINKS.filter(
    (l) => !l.href.includes(currentSlug),
  );

  if (!links.length) return null;

  return (
    <section className="plan-your-visit mt-16 border-t border-foreground/20 pt-10">
      <h2 className="font-display text-xl font-bold uppercase tracking-widest mb-6">
        Explore More
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {links.map(({ href, icon, title, desc }) => (
          <a
            key={href}
            href={href}
            data-track={`faq_cross_link_${href.replace(/^\//, '')}`}
            className="plan-your-visit__card block rounded-lg border border-foreground/20 p-5 transition-colors hover:bg-foreground/5"
          >
            <div className="mb-2 text-2xl" aria-hidden="true">{icon}</div>
            <div className="font-semibold mb-1">{title}</div>
            <p className="text-sm text-foreground/60">{desc}</p>
          </a>
        ))}
        <a
          href="/faq"
          data-track="faq_cross_link_faq"
          className="plan-your-visit__card block rounded-lg border border-foreground/20 p-5 transition-colors hover:bg-foreground/5"
        >
          <div className="mb-2 text-2xl" aria-hidden="true">❓</div>
          <div className="font-semibold mb-1">Visitor FAQ</div>
          <p className="text-sm text-foreground/60">
            Opening hours, tickets, accessibility, and everything else you need before you visit.
          </p>
        </a>
      </div>
    </section>
  );
}
