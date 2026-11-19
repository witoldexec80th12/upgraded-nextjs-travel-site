/**
 * scripts/compile-faq.ts
 *
 * Reads every src/content/<locale>/faq.md file and generates:
 *   • src/data/faq/<locale>.ts   — one typed FaqEnrichment per locale
 *   • src/data/faq/index.ts      — getFaqData(locale) lookup + homepageItems helper
 *
 * Run manually:   npm run faq
 * Automatic:      runs as part of predev / prebuild
 *
 * ── Outputs from one source file ─────────────────────────────────────────────
 *  1. /faq page         — all groups + items, group H2 headings, CTA placements
 *  2. Homepage FAQ block — priority:high items only, flat, max 6
 *  3. FAQPage JSON-LD   — schema:true items (links stripped from answers)
 *
 * ── Adding or updating FAQ content ───────────────────────────────────────────
 *  1. Edit src/content/en/faq.md (or src/content/es/faq.md for Spanish, etc.)
 *  2. Run `npm run faq`
 *  Done — /faq page, schema, and homepage block all update automatically.
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = path.resolve(__dirname, '../src/content');
const OUTPUT_DIR  = path.resolve(__dirname, '../src/data/faq');

mkdirSync(CONTENT_DIR, { recursive: true });
mkdirSync(OUTPUT_DIR,  { recursive: true });

// ── Helpers ───────────────────────────────────────────────────────────────────

function ser(value: unknown): string {
  return JSON.stringify(
    value,
    (_k, v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v),
    2,
  );
}

/** Strip Markdown inline links and formatting for use in JSON-LD answers. */
function toPlainText(md: string): string {
  return md
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) → text
    .replace(/[*_`]/g, '')                    // bold / italic / code
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Read source files ─────────────────────────────────────────────────────────

const mdFiles = readdirSync(CONTENT_DIR)
  .filter((locale) => existsSync(path.join(CONTENT_DIR, locale, 'faq.md')))
  .map((locale) => `${locale}/faq.md`)
  .sort();

if (mdFiles.length === 0) {
  console.warn('[compile-faq] No locale FAQ sources found — nothing compiled.');
  process.exit(0);
}

type CompiledEntry = { locale: string; varName: string };
const compiled: CompiledEntry[] = [];

for (const file of mdFiles) {
  const raw = readFileSync(path.join(CONTENT_DIR, file), 'utf-8');
  const { data: fm } = matter(raw);

  // ── Validate required frontmatter ─────────────────────────────────────────
  const REQUIRED = ['slug', 'locale', 'seo', 'dates', 'breadcrumbs', 'faqGroups'];
  const missing = REQUIRED.filter((k) => !fm[k]);
  if (missing.length) {
    console.error(`[compile-faq] ✗ ${file}: missing field(s): ${missing.join(', ')}`);
    process.exit(1);
  }
  const seoRequired = ['title', 'metaDescription'];
  const missingSeo = seoRequired.filter((k) => !(fm.seo as Record<string, unknown>)[k]);
  if (missingSeo.length) {
    console.error(`[compile-faq] ✗ ${file}: missing seo.${missingSeo.join(', seo.')}`);
    process.exit(1);
  }

  // ── Normalise dates ────────────────────────────────────────────────────────
  const dates = fm.dates as Record<string, unknown>;
  for (const key of ['published', 'modified', 'lastChecked', 'nextReviewDue']) {
    if (dates[key] instanceof Date) {
      dates[key] = (dates[key] as Date).toISOString().slice(0, 10);
    }
  }

  const locale  = fm.locale as string;
  const varName = `_faq_${locale.replace(/-/g, '_')}`;

  // ── Build FaqEnrichment object ────────────────────────────────────────────
  const enrichment: Record<string, unknown> = {
    slug:        fm.slug,
    locale,
    seo:         fm.seo,
    dates:       fm.dates,
    breadcrumbs: fm.breadcrumbs,
    faqGroups:   fm.faqGroups,
  };
  if (fm.ctas)    enrichment.ctas    = fm.ctas;
  if (fm.sources) enrichment.sources = fm.sources;

  // ── Write src/data/faq/<locale>.ts ────────────────────────────────────────
  const tsOut = `\
// @generated — do not edit. Source: src/content/${locale}/faq.md
// Run \`npm run faq\` to regenerate after editing the .md file.
import type { FaqEnrichment } from '@/lib/faq-types';

const data: FaqEnrichment = ${ser(enrichment)};

export default data;
`;

  writeFileSync(path.join(OUTPUT_DIR, `${locale}.ts`), tsOut);
  compiled.push({ locale, varName });
  console.log(`[compile-faq] ✓ ${locale} (${file})`);
}

// ── Generate src/data/faq/index.ts ───────────────────────────────────────────

const importLines = compiled
  .map((c) => `import ${c.varName} from './${c.locale}';`)
  .join('\n');

const mapEntries = compiled
  .map((c) => `  ${JSON.stringify(c.locale)}: ${c.varName},`)
  .join('\n');

const indexOut = `\
// @generated — do not edit. Source: src/content/<locale>/faq.md
// Run \`npm run faq\` to regenerate.
import type { FaqEnrichment, FaqItem } from '@/lib/faq-types';

${importLines}

const FAQ_MAP: Record<string, FaqEnrichment> = {
${mapEntries}
};

/**
 * Returns the FAQ enrichment for a locale, falling back to English.
 * Returns null only if no FAQ file exists at all.
 */
export function getFaqData(locale: string): FaqEnrichment | null {
  return FAQ_MAP[locale] ?? FAQ_MAP['en'] ?? null;
}

/**
 * Returns priority:high FAQ items across all groups, flattened, for use in
 * the homepage compact FAQ block. Max 6 items.
 */
export function getHomepageFaqItems(locale: string, max = 6): FaqItem[] {
  const data = getFaqData(locale);
  if (!data) return [];
  return data.faqGroups
    .flatMap((g) => g.items)
    .filter((i) => i.priority === 'high')
    .slice(0, max);
}

/**
 * Returns items marked schema:true, with Markdown links stripped from answers,
 * ready for the shared server-rendered FAQ structured data.
 */
export function getFaqSchemaItems(locale: string): Array<{ q: string; a: string }> {
  const data = getFaqData(locale);
  if (!data) return [];
  return data.faqGroups
    .flatMap((g) => g.items)
    .filter((i) => i.schema)
    .map((i) => ({ q: i.q, a: stripLinks(i.a) }));
}

/** Strip Markdown inline links and formatting — answers must be plain text in JSON-LD. */
function stripLinks(md: string): string {
  return md
    .replace(/\\[([^\\]]+)\\]\\([^)]+\\)/g, '$1')
    .replace(/[*_]/g, '')
    .replace(/\\s+/g, ' ')
    .trim();
}
`;

writeFileSync(path.join(OUTPUT_DIR, 'index.ts'), indexOut);

console.log(
  `[compile-faq] Done — ${compiled.length} locale(s) compiled → src/data/faq/index.ts`,
);
