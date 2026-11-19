interface Source {
  title: string;
  url: string;
}

interface ArticleSourcesProps {
  sources: Source[];
}

/**
 * Sources / further reading section at the foot of an article.
 *
 * Linking to authoritative external sources (Wikipedia, official museum sites,
 * academic archives) is an E-E-A-T signal — it demonstrates that the content
 * is grounded in verifiable references, not generated fluff.
 */
export function ArticleSources({ sources }: ArticleSourcesProps) {
  if (!sources.length) return null;

  return (
    <footer className="mt-12 pt-8 border-t border-foreground/10">
      <h2 className="text-xs font-semibold tracking-widest uppercase text-foreground/40 mb-4">
        Sources & Further Reading
      </h2>
      <ul className="space-y-2">
        {sources.map((source) => (
          <li key={source.url}>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-foreground/60 hover:text-foreground underline underline-offset-2 transition-colors"
            >
              {source.title}
            </a>
          </li>
        ))}
      </ul>
    </footer>
  );
}
