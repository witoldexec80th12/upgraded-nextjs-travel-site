# Tourist Site SEO & GEO Playbook

This is the canonical SEO/GEO (search + AI-answer-engine optimization)
strategy reference for sites built from this template. It's preserved as
supplied, verbatim, including its Part 2 refinements and the GEO phase.

See `../README.md` ("SEO/GEO" section) for what this template already
automates from the playbook below, and `../INTAKE.md` for the fields each
new site needs to fill in, plus the explicit "SEO Content Pass" step for the
parts of this playbook that require real, event-specific content and are
deliberately **not** automated.

---

Phase 1: Technical Infrastructure (The "Bones")

Goal: Ensure search engines and AI models understand the site's language relationships and business identity immediately.

Move Hreflang to the <head>: * Even if they are in the sitemap, inject them into the HTML source code.
Rule: Every page must link to itself and every other language version (Reciprocity).
Action: In Next.js, use the Metadata API (alternates: { languages: { ... } }).
Define the "Handshake" (Canonical Tags): * Every page must have a canonical tag pointing to its primary URL to prevent "duplicate content" penalties.
Implement JSON-LD Schema (The AI Secret): * Inject a script of type application/ld+json.
Must-haves: LocalBusiness (for physical sites), TouristAttraction, and WebSite.
Action: Use a "Graph" structure to link these entities together.

Phase 2: Content Architecture (The "Hub & Spoke")
Goal: Create a dedicated "Expert Asset" that answers specific user anxieties.
Identify the "Expert Hub": * Instead of burying tips in an FAQ, create a standalone page (e.g., /visitor-guide or /insider-tips).
Internal Linking (The Spoke): * Link to this Hub from the Home Page and the main FAQ.
Rule: Use keyword-rich anchor text (e.g., "Read the 2026 Guide" rather than "Click here").

Phase 3: The Long-Tail Keyword Pass (The "Meat")
Goal: Outrank competitors by answering 4–6 word phrases they are ignoring.
Step 1: Identification: * Find the "Search Intent" for each market (FR, ES, PL, DE).
Look for phrases about timing, specific entrances, parking, or avoiding crowds.
Step 2: JSON Dictionary Expansion: * Create a new section in your translation files (e.g., "seoPass") to store these phrases.
Step 3: Heading "Hooking": * Replace generic headings (like "Information") with the long-tail phrases from Step 1.
Rule: These must be <h2> or <h3> tags, never <span> or <div>.

Phase 4: Visual & Semantic SEO
Goal: Prove "Current Expertise" (E-E-A-T) through details.
Semantic Hierarchy: * Audit the page for important text trapped in <span> tags. Convert these to Headings to give them SEO weight.
Localized Alt Text: * Every image must have a descriptive alt attribute in the native language of the page.
Action: Pull this string from your JSON dictionary so it scales automatically.
FAQ Schema Injection: * On your Hub page, inject specific FAQPage schema. This is the primary data source for ChatGPT/Gemini snippets.

Phase 5: Social & Share Optimization (Click-Confidence)
Goal: Ensure shared links look professional and trustworthy in messaging apps.
Localized Open Graph (OG) Tags: * og:title and og:description must be translated for every locale.
Absolute Image Paths: * Ensure social tags use the full URL (e.g., https://site.it/hero.jpg), not relative paths.
Market Dialect Check: * Review terminology for regional accuracy (e.g., PT-BR vs. PT-PT or Spanish-MX vs. Spanish-ES).

Summary Checklist Part 1 for Evaluating Projects:
[ ] Does the <head> have localized hreflang tags?
[ ] Is there a TouristAttraction or Service JSON-LD schema?
[ ] Does the page have a dedicated long-tail <h1>?
[ ] Are the social preview tags translated?
[ ] Are the core search phrases wrapped in <h2> tags?

After learning more about SEO and GEO here is an update Part 2 for Evaluating Projects:

Canonical strategy for locale URLs is ambiguous in the current doc. The skill says "every page must have a canonical tag" but doesn't address the key decision: should /es/faq canonicalise to itself or to /faq? Self-referencing canonicals per locale are the correct approach — pointing all locales at the English canonical suppresses non-English indexing. Worth adding explicitly:

Locale Canonical Rule: Each locale URL must self-reference (/es/visitor-guide → canonical /es/visitor-guide). Do NOT point all locale variants at the English URL — this tells Google the non-English pages are duplicates.

x-default hreflang isn't mentioned. It should be: every hreflang implementation should include an x-default pointing to the English (or language-selector) URL. The skill mentions reciprocity but omits this.

metadataBase in Next.js — the skill says "use absolute image paths" but doesn't address the Next.js metadataBase setting, which resolves relative paths automatically. Without it, relative OG image URLs produce broken social previews. Worth a callout:

Next.js Note: Set metadataBase in your root layout metadata. Without it, relative OG image paths (/hero.jpg) won't resolve correctly in social crawlers.

Sitemap vs <head> hreflang — the current wording ("even if they are in the sitemap, inject them into the HTML") is correct but could explain why more clearly: Google has stated it prefers head injection and treats sitemap hreflang as supplementary only. The recommended approach is both, not either/or.

BreadcrumbList schema is missing from the "must-haves" list. It's not glamorous but it consistently produces rich results and is low-effort. Should sit alongside LocalBusiness, TouristAttraction, and WebSite.

Phase 2 addition
Anchor text verification step — the skill says "use keyword-rich anchor text" but has no way to audit it. Worth adding:

Audit step: Check that internal links to your Hub page use descriptive anchor text derived from your keyword list (e.g. the translation key resolves to "2026 Visitor Guide for Gandalf´s Castle," not "Click here" or "Read more").

Phase 3 addition
Long-tail h1 is in the checklist but not in the phase instructions. The phase only mentions <h2> and <h3> hooks. The checklist item "Does the page have a dedicated long-tail <h1>?" has no corresponding instruction. Add:

The Hub page <h1> should itself be a long-tail phrase (e.g. "What to Know Before Visiting Juliet's House in 2026"), not a generic title like "Visitor Guide." The h1 is the single highest-weight on-page signal.

Phase 4 addition
Hero image alt text is often overlooked because it's set globally. Worth calling out specifically:

Hero/above-the-fold images are particularly high-value for alt text. A hardcoded alt="Juliet's Balcony" on a Spanish page is a missed signal. Ensure even the primary hero image pulls its alt text from the locale translation dictionary.

Schema answer quality for AI — the skill says FAQPage schema is "the primary data source for ChatGPT/Gemini snippets" but says nothing about what makes a good answer. Should add:

The answer text in FAQPage schema must be complete standalone sentences — AI models read the schema directly, not the rendered HTML. A vague answer like "Yes, booking is required" performs worse than "Online booking is mandatory for all visits to Casa di Giulietta in 2026. No walk-up tickets are available."

New Phase 6: GEO-Specific (AI Engine Optimisation)
The skill is titled "tourist-seo" but the site also serves AI answer engines (ChatGPT, Perplexity, Gemini). There's a whole tactic layer the doc misses entirely:

llms.txt — a plain-text machine-readable file at /llms.txt that AI crawlers (Perplexity, Claude, others) use to understand the site's purpose, structure, and canonical content. Format: Markdown. Include: one-line description, key URLs with descriptions, and language/routing information. This is the GEO equivalent of robots.txt.

Schema answer completeness (covered above) — AI models cite structured data over body text. Treat FAQPage schema answer strings as editorial copy, not implementation details.

x-robots-tag — ensure transactional pages (/checkout, /success, /admin) carry noindex either via meta tag or HTTP header, so AI crawlers don't index or cite them.

Additional Part 2 Checklist additions for the summary

[ ] Does each locale URL have a self-referencing canonical (not pointing to English)?
[ ] Is x-default included in the hreflang set?
[ ] Is there a BreadcrumbList schema on content pages?
[ ] Does the hero/primary image have localized alt text?
[ ] Are FAQPage schema answer strings complete, standalone sentences?
[ ] Is there a /llms.txt file describing the site for AI crawlers?
[ ] Are transactional pages (/checkout, /success) marked noindex?
[ ] Has internal link anchor text been verified to be keyword-rich (not "click here")?
