# Writing & Publishing Articles

Articles are Markdown files with YAML metadata at the top (frontmatter).
Edit the source Markdown, not the generated TypeScript. The article compiler
creates the data and route registry; Next.js renders public article pages
statically during the production build.

> **Canonical policy:** fully translated articles are self-canonical. English
> fallback pages are noindex and canonicalize to English. The compiler, metadata,
> JSON-LD, and sitemap consumers enforce the rules described below.

## 1. Quick start — English only

Copy an existing source as a starting point:

```bash
cp src/content/en/guides/guide/castle-grounds-walk.md \
   src/content/en/guides/guide/my-new-article.md
```

Then:

1. Set `slug: my-new-article` to match the filename without `.md`.
2. Replace the metadata, breadcrumbs, key facts, body, and any optional FAQ,
   sources, author, or subject details. Do not retain unrelated template claims.
3. Add image files and update all hero paths and alt text.
4. Run `npm run articles` to validate the source and regenerate article data.
5. Run `npm run typecheck` and `npm run build`, then preview the article.

The public URL is `/en/guides/my-new-article`. The category directory (`guide`
in this example) organizes the source; it is not part of the public URL.

Compilation also runs before `npm run dev` and `npm run build`. If you edit
Markdown while the development server is already running, run `npm run articles`
again to regenerate its data. Adding a source file does not publish it by itself.

## 2. Adding a translation

Keep the same category and stable English filename under another locale:

```bash
mkdir -p src/content/es/guides/guide
cp src/content/en/guides/guide/my-new-article.md \
   src/content/es/guides/guide/my-new-article.md
```

In the Spanish file:

- Set `locale: es` and `ogLocale: es_ES`.
- Set a localized slug, for example `slug: mi-nuevo-articulo`.
- Translate the title, description, H1, lede, body, key facts, FAQ, image alt
  text, and breadcrumb labels.
- Set breadcrumb links to real localized destinations.
- Keep shared image paths and the original publication date.
- Use an honest modification date for substantive updates.

Run `npm run articles` again. The Spanish public URL becomes
`/es/guides/mi-nuevo-articulo`. You do not manually register its route or
update other translations' alternate links.

Under the required policy, this fully translated Spanish page is self-canonical:
its canonical URL, `og:url`, and JSON-LD Article/WebPage URLs identify
`/es/guides/mi-nuevo-articulo`, not the English URL. Its hreflang set includes
itself and every other available, indexable translation, with English as
`x-default` where appropriate. See Section 4 for complete output examples and
the implementation discrepancy.

Do not publish copied English text as a completed Spanish translation. If an
English fallback is served at a locale-specific URL, it must visibly say that
it is untranslated, carry `noindex`, canonicalize to the English original,
and be excluded from hreflang annotations and sitemaps.

For a new language, also check the site's locale registration and navigation
requirements in `README.md`; copying an article does not translate the site UI.

## 3. Directory layout

```text
src/content/
  en/guides/
    guide/
      my-new-article.md
    history/
      queen-marie-bran-castle.md
  es/guides/
    guide/
      my-new-article.md

public/articles/
  guide/my-new-article/
    hero-mobile.webp
    hero-mobile@2x.webp
    hero-desktop.webp
    hero-desktop@2x.webp
    hero-desktop.jpg
    og.jpg

src/data/articles/             # GENERATED — do not edit
src/lib/article-routes.ts      # GENERATED — do not edit
```

The source pattern is exactly:
`src/content/<locale>/guides/<category>/<stable-english-slug>.md`.

Keep category directories and stable filenames the same across translations.
The English frontmatter slug must match the filename. Categories must start
with a lowercase letter and contain only lowercase letters, numbers, or hyphens.
Slugs use lowercase letters, numbers, and single separating hyphens. Because
categories do not appear in public URLs, two articles cannot share the same
public slug in one locale, even when their category directories differ.

Changing a published slug changes its URL. Plan explicit redirects before
renaming; the compiler does not remember previous slug values.

## 4. Multilingual URLs and canonical behavior

- English: `/en/guides/<english-slug>`.
- Translation: `/<locale>/guides/<localized-frontmatter-slug>`.
- Only translations with source files get article routes.
- Every article group requires an English source.

### Required policy: fully translated articles

Each published, fully translated language version is **self-canonical**.
Its canonical URL points to its own localized URL, using the current route
format `/<locale>/guides/<translated-slug>`. The same page URL is used by
`og:url` and JSON-LD Article/WebPage URL fields and page-specific identifiers.
JSON-LD `inLanguage` describes the actual translated content.

Hreflang annotations must include **all available, indexable translations,
including the current page**. Each member must emit the same reciprocal set.
Use the indexable English version as `x-default` where appropriate.
Do not include untranslated fallback pages, noindex pages, or missing routes.

Example required head for a fully translated Spanish article, assuming English
and Spanish are the only available, indexable versions (`example.com` represents
the configured `SITE.origin`):

```html
<link rel="canonical" href="https://example.com/es/guides/mi-nuevo-articulo">
<meta property="og:url" content="https://example.com/es/guides/mi-nuevo-articulo">
<link rel="alternate" hreflang="en" href="https://example.com/en/guides/my-new-article">
<link rel="alternate" hreflang="es" href="https://example.com/es/guides/mi-nuevo-articulo">
<link rel="alternate" hreflang="x-default" href="https://example.com/en/guides/my-new-article">
```

The English page is self-canonical at `/en/guides/my-new-article` and emits
the same alternate set. Corresponding Spanish JSON-LD (abbreviated):

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "@id": "https://example.com/es/guides/mi-nuevo-articulo#article",
      "url": "https://example.com/es/guides/mi-nuevo-articulo",
      "mainEntityOfPage": "https://example.com/es/guides/mi-nuevo-articulo",
      "inLanguage": "es"
    },
    {
      "@type": "WebPage",
      "@id": "https://example.com/es/guides/mi-nuevo-articulo#webpage",
      "url": "https://example.com/es/guides/mi-nuevo-articulo",
      "inLanguage": "es"
    }
  ]
}
</script>
```

This abbreviated graph illustrates URL policy; the current renderer emits
individual JSON-LD nodes. It is not a replacement for the complete generated
article schema or an instruction to change its serialization.

### Required policy: English fallback pages

If a locale-specific page serves untranslated English content:

- Display a visible notice such as “This article has not been translated into
  Spanish. You are reading the English version.”
- Mark the fallback `noindex`.
- Canonicalize it to the English original.
- Exclude its URL from all hreflang sets and sitemap entries, including sitemap
  language alternates; it must not advertise itself as a translated alternative.
- Use the English original for `og:url` and any emitted Article/WebPage JSON-LD
  URLs, with `inLanguage: "en"`. Do not label English text as Spanish.

For a hypothetical fallback at `/es/guides/my-new-article`:

```html
<meta name="robots" content="noindex, follow">
<link rel="canonical" href="https://example.com/en/guides/my-new-article">
<meta property="og:url" content="https://example.com/en/guides/my-new-article">
```

If Article JSON-LD is emitted for that fallback, its relevant fields identify
the English original, not a separate Spanish article:

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "@id": "https://example.com/en/guides/my-new-article#article",
  "url": "https://example.com/en/guides/my-new-article",
  "mainEntityOfPage": "https://example.com/en/guides/my-new-article",
  "inLanguage": "en"
}
```

Any accompanying WebPage node must likewise use the English original URL and
English language. The fallback URL is not a translation for discovery purposes.

### Declaring actual content language and indexability

The compiler defaults `contentLocale` to the source locale: an article in the
Spanish directory is an editorial declaration that it is translated into Spanish.
For an intentionally published English fallback, explicitly set
`contentLocale: en`. Its localized URL is retained, but it gets the English
canonical, a visible English-content notice, noindex, and no hreflang membership
or sitemap entry. JSON-LD uses the actual content language.

Use `noindex: true` to exclude an otherwise translated page from indexing,
hreflang membership, and the sitemap. The compiler does not guess translation
quality from prose: authors must accurately declare English fallback content
and only publish genuine translations as translated.

Canonical fields are derived; do not add a `canonical` frontmatter field.

## 5. Frontmatter reference

Use this structure, replacing the example image paths with files that exist:

The English source below has the required canonical
`/en/guides/my-new-article`. A fully translated file with `locale: es`,
`ogLocale: es_ES`, and `slug: mi-nuevo-articulo` must instead be self-canonical
at `/es/guides/mi-nuevo-articulo`, with that same URL in `og:url` and JSON-LD.
These are generated output requirements, not additional frontmatter fields.
An English copy in the Spanish directory is not a completed translation;
if served as a fallback, Section 4's notice/noindex/exclusion rules apply.

For example, an English fallback source in the Spanish directory declares:

```yaml
locale: es
ogLocale: es_ES
slug: my-new-article
contentLocale: en
```

Keep its content in English; the compiler automatically applies the fallback
noindex policy. `noindex: true` is also supported for a translated article that
must not appear in search discovery.

```yaml
---
locale: en
ogLocale: en_US
slug: my-new-article
title: "A useful, specific article title"
metaDescription: "A clear summary explaining what readers will learn."
h1: "The headline displayed on the page"
lede: "A short introduction that answers the reader's main question."
datePublished: "2026-11-18"
dateModified: "2026-11-18"
category: "Visitor Guide"
readTime: "5 min read"
hero:
  mobile: /articles/guide/my-new-article/hero-mobile.webp
  mobile2x: /articles/guide/my-new-article/hero-mobile@2x.webp
  desktop: /articles/guide/my-new-article/hero-desktop.webp
  desktop2x: /articles/guide/my-new-article/hero-desktop@2x.webp
  fallback: /articles/guide/my-new-article/hero-desktop.jpg
  og: /articles/guide/my-new-article/og.jpg
  alt: "Describe what the photograph actually shows."
  width: 1440
  height: 960
  focal: "50% 50%"
  creditText: "Photo credit, where applicable"
breadcrumbs:
  - name: Home
    path: /en
  - name: My new article
    path: null
keyFacts:
  - name: Best for
    description: "A concise, verified fact"
faqHeading: "Frequently asked questions"
faq:
  - q: "A real question readers ask?"
    a: "A complete, accurate answer."
sources:
  - title: "Official source"
    url: "https://example.org/"
author:
  name: "Actual author name"
---

## First section

Your article text.
```

### Required fields and checks

The compiler requires `slug`, `title`, `metaDescription`, `h1`, `lede`,
`datePublished`, `dateModified`, `hero`, `breadcrumbs`, and `keyFacts`.
It also requires a correctly formatted `ogLocale`.

The locale can be inferred from the source directory, but specifying `locale`
explicitly is clearer; if provided, it must match that directory. Dates must
use `YYYY-MM-DD`; quoted strings are recommended. Keep publication dates
accurate and modification dates no earlier than publication dates.

The compiler validates required field types and nested structures and rejects
whitespace-only strings. It requires `hero.mobile`, `hero.mobile2x`,
`hero.desktop`, `hero.desktop2x`, `hero.fallback`, descriptive `hero.alt`, and
positive integer width/height. All supplied hero paths, including optional
`hero.og`, must resolve to existing files inside `public/`; traversal and
out-of-directory symlinks are rejected. Dates must be real calendar dates and
`dateModified` must not precede `datePublished`.

Additional body H1 headings (both `# Heading` and Setext `Heading` followed by
`===`) are rejected. Code examples are ignored for heading and link checks.
The compiler also rejects unresolved `INTERNAL-LINK:` tokens, unknown related
article or tour IDs, and broken links to localized or legacy article routes. It does not
make network requests to verify external links or check every non-article page.
Errors identify the source filename and field or body line. These validation
failures stop compilation before generated article files are replaced.

`category` and `readTime` are optional display fields, defaulting to the source
category and `5 min read`. FAQ, sources, author, and `schemaEntity` are optional.
FAQ markup does not guarantee a Google rich result.

### Subject-specific structured data

Without an override, article schema uses the site's configured attraction.
For an article about a different subject, the supported override is:

```yaml
schemaEntity:
  type: TouristAttraction
  name: "Actual subject name"
  url: "https://official-subject.example/"
```

If provided, `schemaEntity` must have a type and nonempty name; its optional URL
must be an absolute HTTP(S) URL. Choose accurate schema types and real sources,
not template entities.

## 6. Language metadata

`locale` is the URL language code; `ogLocale` is the language-region code used
for social metadata. Common supported examples:

| Directory / `locale` | `ogLocale` |
|---|---|
| `en` | `en_US` |
| `es` | `es_ES` |
| `fr` | `fr_FR` |
| `de` | `de_DE` |
| `it` | `it_IT` |
| `pl` | `pl_PL` |
| `pt` | `pt_PT` |
| `nl` | `nl_NL` |
| `ro` | `ro_RO` |

Choose the regional variant appropriate to the content. The compiler requires
an explicit `ogLocale` rather than silently guessing one.

## 7. Writing the body and links

Start body headings with `##`; the frontmatter supplies the single page H1.
Use `###` for subsections. Markdown lists, blockquotes, and GitHub-flavored
Markdown tables are supported. Four or more H2 sections produce a jump menu.

For new internal links, use actual locale-prefixed destinations:

```markdown
[Read the related guide](/en/guides/visiting-peles-castle)
[Return to the homepage](/en)
```

Use the corresponding translated path in a translated article. Normal
Markdown links are rendered as anchors; they are not automatically localized.

For links that should follow the article's language, use a stable reference:

```markdown
[Read the related guide](INTERNAL-LINK:visiting-peles-castle)
[Read the history](INTERNAL-LINK:history/history-and-making-of-peles-castle)
```

Use the English source filename without `.md`, optionally prefixed by its
category directory. Do not use the translated slug. The compiler resolves the
reference to the genuine translation in the referring page's locale, or to the
English original when no translation exists. An English duplicate at a
localized URL is not picked as a translation. Use ordinary links when a
specific URL or fragment is needed.

### Related content

Each of these frontmatter lists is optional:

```yaml
relatedGuides:
  - visiting-peles-castle
relatedArticles:
  - history/history-and-making-of-peles-castle
relatedTours:
  - castle-tickets
```

The first two lists use the same article IDs; they let editors group their
choices without requiring specific category names. `relatedTours` takes
package slugs from the tour catalog and links to the referring locale's tour
route, following the catalog's translation and fallback behavior. The page
shows one Related content section with titles from the registries, in field
and list order. Duplicate destinations are shown once; unknown IDs and
self-references are compilation errors. Omit the fields to show no section.

Breadcrumb paths are also explicit. The compiler converts exactly `/` to the
article's locale homepage, but does not rewrite other paths such as
`/#discover`. Prefer explicit paths such as `/en/#discover` when appropriate.

## 8. Hero images

Store shared image variants at
`public/articles/<category>/<stable-english-slug>/`. Their public URLs start
with `/articles/`, not `/public/articles/`.

The current renderer uses a native `<picture>` with WebP sources, 1×/2×
variants, a mobile breakpoint at 1023px, and a fallback `<img>`. These hero
assets do **not** go through `next/image` automatic optimization.

Suggested export sizes and budgets (recommendations, not compiler limits):

| File | Dimensions | Target size |
|---|---|---|
| `hero-mobile.webp` | 480 × 480 | < 40 KB |
| `hero-mobile@2x.webp` | 960 × 960 | < 80 KB |
| `hero-desktop.webp` | 1440 × 960 | < 120 KB |
| `hero-desktop@2x.webp` | 2880 × 1920 | < 200 KB |
| `hero-desktop.jpg` | 1440 × 960 | compressed fallback |
| `og.jpg` | 1200 × 630 | < 200 KB |

Use actual image dimensions in the metadata, meaningful alt text, and an
appropriate focal point. Translations normally share assets but translate alt
text. Use images you have permission to publish.

## 9. Generated output and verification

`npm run articles`:

1. Reads the locale-specific Markdown sources.
2. Validates frontmatter types and nested fields, real dates and their ordering,
   hero asset paths, Markdown H1 headings, article links, and language metadata.
3. Requires an English source for each article group and rejects duplicate
   locale routes.
4. Regenerates `src/data/articles/` and `src/lib/article-routes.ts`, including
   translation groups and legacy category-first redirect mappings.

It does **not** produce a `dist/` static website. `npm run build` compiles the
sources and runs Next.js static generation into its managed `.next/` output.
This project is a normal Next.js deployment, not a static `output: 'export'`.

The shared metadata layer produces titles, descriptions, canonicals, language
alternates, social metadata, and JSON-LD. Native Next.js sitemap and robots
routes provide search discovery rules. Absolute URLs depend on `SITE.origin`;
check the real site identity and domain before publishing.

### Canonical-policy acceptance checks

The production HTML and sitemap must be checked against the required policy,
not merely against today's generated values:

| Page type | Canonical, `og:url`, Article/WebPage JSON-LD URLs | Indexing and discovery |
|---|---|---|
| English original | Own `/en/guides/<english-slug>` URL | Include when indexable |
| Fully translated article | Own `/<locale>/guides/<translated-slug>` URL | Include in sitemap and reciprocal hreflang, including self |
| Untranslated English fallback | English original URL; JSON-LD language `en` | Visible untranslated notice; `noindex`; exclude fallback URL from hreflang and sitemap |

For the Spanish example, inspect the canonical HTML tag, `og:url`, and JSON-LD
to confirm they all identify `/es/guides/mi-nuevo-articulo`. Check that English
and Spanish both list the same indexable language variants, including
themselves, and that `x-default` references English where appropriate.
Check fallback output separately: its English canonical does not substitute
for the required `noindex`, visible notice, or discovery exclusions.

The foundation tests inspect generated files and fetch initial HTML from a
temporary production server (never the development server). They check every
registered article's H1, title/description, canonical, `og:url`, JSON-LD,
reciprocal hreflang, substantive article text, robots directives, sitemap
membership, and HTTP status. Existing English fallback guides are also fetched
and checked for a visible notice, noindex, and sitemap/hreflang exclusion.
Errors include source filenames and URLs; critical failures exit nonzero.
Isolated fixtures run within the same command without adding published pages.

Before pushing:

```bash
npm run articles
npm run test:articles
npm run typecheck
npm run build
npm run test:foundation
```

Also preview the article and verify its images, links, breadcrumbs, mobile
layout, and intended canonical/language tags. Do not treat passing compilation
as a factual, editorial, or comprehensive link review. Git pushes remain a separate
manual step.

## 10. Removing articles

### Remove one translation

For example:

```bash
rm src/content/es/guides/guide/my-new-article.md
npm run articles
```

This removes that translation from the generated data and language links.
Rebuild and deploy for the public site to change. Update any links to the
removed URL and decide whether it needs a redirect.

### Remove an entire article group

Delete its matching source file from every locale directory, then run
`npm run articles` and rebuild. Do not delete only the English source while
translations remain; compilation requires an English source for the group.

Compilation regenerates the article data and removes obsolete generated
entries. It does not delete shared images or fix incoming links. Remove unused
images only after checking other references, and preserve redirects for removed
published URLs when appropriate.
