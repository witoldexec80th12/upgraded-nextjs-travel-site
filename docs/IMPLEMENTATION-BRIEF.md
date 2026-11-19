# Implementation Brief
_Source repo: [witoldexec80th12/event-ticket-site-template](https://github.com/witoldexec80th12/event-ticket-site-template)_

This document describes two completed workstreams that any project importing this template should incorporate. Both are already merged into `main`.

---

## Workstream 1 — Replace placeholder content with real pages

### What changed and why
Five pages (`/contact`, `/faq`, `/terms`, `/privacy`, `/cookies`) and the central config file (`event.en.ts`) previously contained dummy prose and a fictitious legal entity (`"Royal Heritage Tickets LLC"`). These were replaced with production-quality content drawn from the live site at **witoldexec80th12/rjticket**.

### Files affected

#### `src/content/event.en.ts`
- `legalEntity.companyName` → `"50 Pomodoros Incorporated"`
- `legalEntity.email` → `"info@50pomodoros.com"`
- `contact.email` → `"customerservice@50pomodoros.com"`
- `contact.description` → two real Verona-flavoured paragraphs (see file)
- `faq.items` → 9 real Casa di Giulietta Q&As (see file)

#### `src/pages/ContentPage.tsx`
- `/contact` route: renders two paragraphs from `config.contact.description`, an `<a>` mailto link for `config.contact.email`, and footer links to Privacy, Cookies, and Terms pages.
- `/faq` route: no structural change; content feeds from `event.en.ts`.

#### `src/pages/LegalPage.tsx`
Completely rewritten — three self-contained section components:

| Component | Sections | Notes |
|---|---|---|
| `PrivacyContent` | 13 sections | Uses a `LegalBasis` card helper |
| `TermsContent` | 12 sections | — |
| `CookiesContent` | 6 sections | Uses a `SubSection` helper |

> **Known limitation (task #13):** Entity strings inside `LegalPage.tsx` are still hardcoded as `"50 Pomodoros Incorporated"` / `"info@50pomodoros.com"` / `"casa-giulietta.it"`. A follow-up task will wire them to `config.legalEntity.*` so new deployments don't ship the wrong entity name.

---

## Workstream 2 — Discover section + Article pages with expandable ticket CTA

### New files

#### `src/components/StickyTicketCta.tsx`
A fixed bottom bar that renders on every article page.

**Collapsed state** (always visible, 68 px tall):
- Left: `config.faq.mandatoryNote` (the "online only" notice text from the config)
- Right: "Purchase Tickets" button (styled with `config.brand.colors.primary`)

**Expanded state** (slides up on click):
- Semi-transparent backdrop; sheet animates in via `translateY` CSS transition
- Compact ticket-type cards, one per `config.ticketTypes` entry
- Each card shows: ticket title, price summary, and two `Counter` controls — Adult (€adultPrice) and Child <5yr (free or childPrice)
- Full-width "Purchase Tickets" button; on press serialises quantities to URLSearchParams and navigates to `/schedule`
- Close (×) button collapses back to bar

Usage:
```tsx
import { StickyTicketCta } from '@/components/StickyTicketCta';
// Place inside PageLayout, after article content
<StickyTicketCta />
```
No props required; reads locale and config internally.

#### `src/pages/ArticlePage.tsx`
Simple article layout page. Props: `{ slug: string }`.

- Looks up the article from `config.discoverArticles` by slug
- Renders: "DISCOVER" eyebrow → serif `<h1>` → excerpt → body paragraphs
- Mounts `<StickyTicketCta />` at the end (fixed to viewport bottom)
- Calls `useSeo` with breadcrumbs: Home → `#discover` → article title

### Modified files

#### `src/content/event.en.ts`

Two additions to the type system and config data:

```ts
// New type (added above EventConfig)
export type DiscoverArticle = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string[]; // paragraphs
};

// New field on EventConfig
discoverArticles: DiscoverArticle[];
```

The `eventConfig` object now contains three placeholder articles with slugs `article-1`, `article-2`, `article-3`. Replace `title`, `excerpt`, and `body` with real content; the slugs can be renamed to match real URL paths.

#### `src/pages/Home.tsx`

A new **Discover section** is inserted between the Getting There section and the floating checkout bar:

```tsx
<section id="discover" className="py-20 px-6 bg-muted/20">
  <div className="max-w-5xl mx-auto">
    <p className="text-xs font-bold tracking-widest uppercase mb-3" style={...}>Discover</p>
    <h2 className="text-3xl md:text-4xl font-serif font-bold">Discover</h2>
    <div className="grid md:grid-cols-3 gap-6 mt-10">
      {config.discoverArticles.map(article => (
        <a href={`/article/${article.slug}`} ...>
          <h3>{article.title}</h3>
          <p>{article.excerpt}</p>
          <span>Read the guide →</span>
        </a>
      ))}
    </div>
  </div>
</section>
```

Three-column card grid on desktop, stacked on mobile. Each card links to `/article/:slug`.

#### `src/App.tsx`

Three new routes added inside `<Switch>`:

```tsx
import ArticlePage from '@/pages/ArticlePage';

// inside AppRouter's <Switch>:
<Route path="/article/article-1"><ArticlePage slug="article-1" /></Route>
<Route path="/article/article-2"><ArticlePage slug="article-2" /></Route>
<Route path="/article/article-3"><ArticlePage slug="article-3" /></Route>
```

When renaming articles, update the slug in both `event.en.ts` (the `slug` field) and these route paths.

---

## Implementation checklist

- [ ] Replace `discoverArticles` placeholder content in `event.en.ts` with real titles, excerpts, and body paragraphs
- [ ] Rename article slugs in `event.en.ts` **and** the three `<Route>` paths in `App.tsx`
- [ ] Replace hardcoded entity strings in `LegalPage.tsx` with `config.legalEntity.*` values (task #13)
- [ ] Update `seo.siteUrl` in `event.en.ts` from `"https://example.com"` to the real production domain
