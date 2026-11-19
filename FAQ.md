# Writing & Managing the FAQ

The FAQ is authored in `src/content/en/faq.md` (one file per language). A compile step generates everything the site needs from that single source — the `/<locale>/faq` page, the homepage compact FAQ block, and the FAQPage JSON-LD schema.

---

## Quick start

```bash
# Edit the FAQ source
edit src/content/en/faq.md

# Compile (or just restart the dev server — it runs automatically)
npm run faq
```

---

## File locations

| What | Where |
|---|---|
| FAQ source (edit this) | `src/content/<locale>/faq.md` |
| Generated TypeScript (do not edit) | `src/data/faq/<locale>.ts` |
| Generated registry (do not edit) | `src/data/faq/index.ts` |

---

## Three outputs from one file

### 1 — `/faq` page
All `faqGroups` are rendered in order. Each group gets an H2 heading and an accordion. CTA buttons appear at positions defined by the `placement` field.

### 2 — Homepage compact FAQ block
`getHomepageFaqItems(locale, max?)` returns items where `priority: high`, flattened across all groups, up to a maximum count (default 6). Import this wherever you want a compact FAQ on the home page.

### 3 — FAQPage JSON-LD
`getFaqSchemaItems(locale)` returns all items where `schema: true`, with Markdown links stripped from the answers (Google disallows links in FAQ schema answer text). Pass directly to `useSeo({ faqItems })`.

---

## Frontmatter reference

Everything between the two `---` lines is frontmatter. The body section below them is a human-readable preview — the page component renders from the structured `faqGroups` data, not the body.

```yaml
---
slug: my-venue-faq          # Required. Identifier (e.g. "bran-castle-faq")
locale: en                  # Required. Determines output filename (src/data/faq/en.ts)

seo:
  title: "..."              # Required. <title> and og:title (~60 chars)
  metaDescription: "..."    # Required. Meta description (~155 chars)
  ogTitle: "..."            # Optional. Shorter on-page H1 (falls back to title)
  ogDescription: "..."      # Optional. Intro paragraph above groups (falls back to metaDescription)

dates:
  published: "2026-08-01"   # Required. Always quote YYYY-MM-DD
  modified: "2026-08-01"    # Required. Update on every content change
  nextReviewDue: "2026-11-01"   # Optional. Content governance reminder
  freshnessLevel: high          # Optional. "high" | "medium" | "low"

breadcrumbs:
  - name: Home
    href: "/"
  - name: FAQ
    href: "/faq"

ctas:
  primary:
    label: "Book tickets online"
    href: "/#tickets"
    placement: "after-tickets"   # "after-<group-id>" or "end"
  secondary:
    label: "Read the visitor guide"
    href: "/visitor-guide"
    placement: "end"

faqGroups:
  - name: "Tickets and advance booking"  # Rendered as H2 on the page
    id: tickets                          # Used in CTA placement and URL fragment
    priority: high                       # Group-level priority (informational)
    items:
      - q: "Question text?"
        a: >-
          Answer text. May contain [inline links](/path) — they render in the
          accordion but are stripped from JSON-LD answers automatically.
        schema: true       # Include in FAQPage JSON-LD. Set false for volatile answers.
        priority: high     # "high" items appear in the homepage compact block
        links:             # Editorial only — tracks links that should appear in the answer
          - href: /contact
            anchor: "contact us"
        intent: ticket-decision   # Editorial label — not rendered

sources:
  - label: "Official Site"
    url: "https://example.com"
    type: official           # "official" | "authority-database" | "press"
    supports:                # Editorial: which claims this source backs up
      - "Opening hours"
      - "Ticketing rules"
---
```

---

## CTA placement

Set `ctas.primary.placement` to `"after-<group-id>"` to insert a CTA button after that group's accordion:

```yaml
ctas:
  primary:
    label: "Book tickets"
    href: "/#tickets"
    placement: "after-tickets"   # inserts after the group with id: tickets
  secondary:
    label: "Read more"
    href: "/visitor-guide"
    placement: "end"             # inserts after all groups
```

---

## Adding a new group

```yaml
faqGroups:
  # ... existing groups ...
  - name: "Group Heading"
    id: my-group           # unique, kebab-case
    priority: medium
    items:
      - q: "Question?"
        a: "Answer."
        schema: true
        priority: medium
```

No other files need editing — the page, JSON-LD, and homepage block all update on next compile.

---

## Adding a language

```bash
cp src/content/en/faq.md src/content/es/faq.md
# Edit src/content/es/faq.md: set locale: es and translate content
npm run faq
```

`getFaqData('es')` returns the Spanish FAQ; it falls back to English if no Spanish file exists.

---

## Schema rules

Google's FAQPage rich result requirements:
- Each answer must be a complete standalone sentence.
- No HTML links in answers (the compile script strips them automatically).
- Questions and answers on the page must exactly match the JSON-LD text.
- Only set `schema: false` for items whose answers contain prices, dates, or
  other details that change frequently and which you can't commit to keeping
  up to date.

---

## What runs automatically

| Hook | What happens |
|---|---|
| `npm run dev` | compile-faq → compile-articles → generate-seo-files → vite dev |
| `npm run build` | compile-faq → compile-articles → generate-seo-files → vite build → prerender |
| `npm run faq` | compile only |
