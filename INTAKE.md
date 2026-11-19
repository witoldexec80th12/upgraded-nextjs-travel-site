# Event Site Intake

Fill this out once per new client/event, then use it to write `src/content/event.en.ts` (each section header below maps directly to a field in that file). Leave nothing blank — write "N/A" if something truly doesn't apply.

## 1. Brand
- **Event/venue name:** 
- **Short logo text** (shown in header if no logo image): 
- **Logo image?** (yes/no, filename if yes): 
- **Primary color** (hex or description, e.g. "deep forest green"): 
- **Accent color** (hex or description, e.g. "warm gold"): 
- **Heading font** (default: Playfair Display — change only if the brand has its own): 
- **Body font** (default: Inter): 

## 2. Hero Section
- **Badge text** (small label above the headline, e.g. "Online Booking Only"): 
- **Headline:** 
- **Subheadline (1-2 sentences):** 
- **Call-to-action button label** (e.g. "Purchase Tickets"): 
- **Hero image filename** (drop the file in `/public`, e.g. `hero.jpg`): 

## 3. Ticket Types
Repeat this block for each ticket type:
- **Name:** 
- **Description:** 
- **Hours/availability text:** 
- **Image filename:** 
- **Adult price:** 
- **Child price** (0 if none): 

## 4. FAQ
- **Section heading** (default: "Frequently Asked Questions"): 
- **Mandatory-booking note** (if online booking is required, one sentence): 
- **Questions & answers** (as many as needed):
  - Q: 
    A: 
  - *SEO/GEO note: write each answer as a complete, standalone sentence — AI answer engines (ChatGPT, Perplexity, Gemini) read the FAQ schema text directly, not the rendered page. "Yes, booking is required" performs worse than "Online booking is mandatory for all visits to [venue] in [year]. No walk-up tickets are available."*

## 5. Activities
- **Section heading:** 
- **Subheading:** 
- **Activities** (title, description, and status like "Available at entrance" or "Coming Soon"):

## 6. Location
- **Venue name:** 
- **Full address:** 
- **Google Maps embed URL** (share → embed a map → copy the `<iframe src="...">` URL): 
- **Getting there bullets** (icon type — bus/train/car/etc. — plus one line each): 

## 7. Contact
- **Section heading:** 
- **Intro copy** (a few short lines): 
- **Support email:** 
- **Support phone:** 
- **Note about the contact form recipient:** 

## 8. Legal Entity
(Used only on the fixed Privacy/Terms/Cookies pages — do not rewrite those pages themselves.)
- **Legal company name:** 
- **Registered address:** 
- **Legal/contact email:** 

## 9. Assets Checklist
Drop these files into `/public` using these exact names (or update the filenames in your config to match what you provide):
- [ ] `hero.jpg` — hero background image
- [ ] one image per ticket type (e.g. `full-ticket.jpg`, `courtyard-ticket.jpg`)
- [ ] `favicon.svg` (optional — defaults to a generic icon if not replaced)

## 10. Translations (optional, only if going beyond English)
- Which additional locales need real (not fallback) content? 
- Who is providing the translated copy, and by when? 

## 11. SEO/GEO Setup (ships automatically once filled in)
These fields drive `event.en.ts`'s `seo` block. Once filled in, the site
automatically gets self-referencing canonical + hreflang tags, a JSON-LD
schema graph, absolute-URL social previews, `sitemap.xml`, and `/llms.txt` —
see `docs/SEO-GEO-PLAYBOOK.md` for the full strategy this implements.

> **⚠ Before going live — two values in `src/config/site.ts` must be set:**
> - `SITE.origin` — the real production domain (e.g. `https://my-event.com`, no trailing slash). This single value propagates to every canonical URL, hreflang href, OG/Twitter image tag, and JSON-LD `@id` across the entire site. A placeholder here silently breaks all of them.
> - `SITE.ga4Id` — the GA4 measurement ID (e.g. `"G-XXXXXXXXXX"`). Set to `null` to disable GA4. Events only start after the configured consent integration grants analytics consent.

- **Production domain** (e.g. `https://my-event.com` — no trailing slash; goes into `SITE.origin` in `src/config/site.ts`): 
- **GA4 Measurement ID** (e.g. `G-XXXXXXXXXX` — goes into `SITE.ga4Id` in `src/config/site.ts`; leave blank to disable analytics): 
- **Business/schema type:** `TouristAttraction` or `LocalBusiness`? 
- **GPS coordinates** (latitude, longitude — for the map/JSON-LD `geo` field): 
- **Opening hours** (structured, e.g. "Mon–Fri 9:00–18:00, Sat–Sun 10:00–17:00" — used for JSON-LD `openingHoursSpecification`): 
- **Social profile links** (Facebook, Instagram, Twitter/X, TikTok — used for JSON-LD `sameAs`, optional): 
- **Per-page meta descriptions** (1-2 sentences each for home/schedule/faq/activities/contact — optional, falls back to on-page copy if left blank): 

### Analytics and reporting

Read `ANALYTICS.md` before enabling analytics. For each new site, decide:
- **Primary funnel profile:** `ticketing`, `lead_generation`, or `custom`
- **Primary outcome and evidence:** the real events that mean a ticket was paid, a quote was submitted, or a signup was confirmed
- **Destinations:** GA4, optional Vercel Runtime Logs/Log Drain, or both
- **Consent manager:** the CMP/UI that will call `setAnalyticsConsent(true/false)`; this template does not include a consent banner
- **Vercel audit events:** the exact allowlisted events, if Vercel logging is enabled
- **Reporting owner:** where reports will be reconstructed, how duplicate `event_id` values will be removed, and who reviews retention/access

Do not mark a client click or success-page visit as a confirmed purchase or lead outcome. Those events require authoritative server/provider confirmation.

## 12. Editorial Articles (blog-style content pages)

Articles live in `content/articles/<slug>.md` — YAML frontmatter (metadata) followed by the article body in Markdown. Running `npm run articles` (or just starting the dev server) compiles each `.md` file into a typed TypeScript module and automatically wires up the route, sitemap entry, SSG prerender, and Schema.org JSON-LD. **Never edit the generated files in `src/data/articles/` directly.**

**To add a new article:**
1. Copy `content/articles/queen-marie-bran-castle.md` to `content/articles/<your-slug>.md`
2. Fill in the frontmatter (title, metaDescription, hero image paths, keyFacts, faq, sources)
3. Write the article body in Markdown below the `---` closing delimiter
4. Drop hero images in `public/articles/<your-slug>/` (see hero field for expected filenames)
5. Run `npm run articles` — the article page, sitemap, and all SEO tags update automatically

**Required frontmatter fields:** `slug`, `title`, `metaDescription`, `h1`, `lede`, `datePublished`, `dateModified`, `hero`, `breadcrumbs`, `keyFacts`
**Optional:** `faqHeading`, `faq` (adds FAQPage schema), `sources`, `author`, `category`, `readTime`

**Always quote dates** to prevent YAML from parsing them as Date objects: `datePublished: "2026-07-28"`

---

## 13. SEO Content Pass — do this later, with real content
Do **not** fill this in with placeholder copy. This is real, event-specific
content work that happens once the client's actual details are known —
track it as a follow-up step, not something to skip or fake:
- [ ] **Visitor-guide "Hub" page** (e.g. `/visitor-guide`): a dedicated page answering visitor anxieties (best times to go, specific entrances, parking, avoiding crowds), linked from Home and the FAQ with keyword-rich anchor text (not "Click here"). Its `<h1>` should itself be a long-tail phrase (e.g. "What to Know Before Visiting [Venue] in [Year]"), not a generic title.
- [ ] **Long-tail keyword headings**: research the 4-6 word phrases each target market (per locale) actually searches for, and rewrite generic headings ("Information") into those phrases as real `<h2>`/`<h3>` tags.
- [ ] **Localized hero/content alt text**: once additional locale content files (`event.es.ts`, etc.) exist, make sure image alt text is pulled from each locale's dictionary rather than left in English.
- [ ] **FAQ answer-quality review**: re-read every FAQ answer against the "complete standalone sentence" bar above (see section 4) once real content is in.
