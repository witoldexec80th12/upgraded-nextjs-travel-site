// Single source of truth for the production domain, brand authority, and analytics.
// Every canonical URL, hreflang href, OG image URL, and JSON-LD @id is derived
// from SITE.origin — never hardcode a domain anywhere else in the codebase.
//
// Pre-launch checklist:
//   [ ] Set SITE.origin to the real production domain (no trailing slash)
//   [ ] Set SITE.ga4Id to the real GA4 measurement ID
//   [ ] Verify SITE.attraction.sameAs links are all live and correct
//   [ ] Set SITE.organization.email to the real support email

export const SITE = {
  // TODO: replace with the real production domain before going live.
  // This value drives every canonical URL, hreflang href, OG image tag,
  // and JSON-LD @id across the entire site.
  origin: 'https://example.com',

  brandName: 'Bran Castle',
  brandId: 'bran-castle',

  // First entry is treated as x-default for hreflang.
  languages: ['en'] as string[],
  defaultLanguage: 'en',
  // UI routes kept from the original template. Event copy currently falls back
  // to English; add localized event configs before claiming full translations.
  supportedLocales: ['en', 'es', 'pt', 'it', 'fr', 'pl', 'de', 'nl', 'el', 'ru', 'ko', 'ja', 'zh'],
  // Actual guide translations include Romanian, independently of UI coverage.
  contentLocales: ['en', 'de', 'it', 'fr', 'pl', 'es', 'ro'],
  defaultPackage: 'castle-tickets',

  features: {
    hutAdmin: true,
  },

  navigation: {
    header: [
      { href: '/#tickets', labelKey: 'nav.tickets' },
      { href: '/activities', labelKey: 'nav.activities' },
    ],
    footer: [
      { href: '/faq', labelKey: 'footer.faq' },
      { href: '/contact', labelKey: 'footer.contact' },
      { href: '/terms', labelKey: 'footer.terms' },
      { href: '/privacy', labelKey: 'footer.privacy' },
      { href: '/cookies', labelKey: 'footer.cookies' },
    ],
  },

  metadata: {
    titleSeparator: ' | ',
    twitterCard: 'summary_large_image' as const,
  },

  organization: {
    name: 'Bran Castle',
    // TODO: set the real support / tickets email.
    email: 'tickets@example.com',
    logoPath: '/favicon.svg',
    // Independence disclosure (checklist items 55 / 113-114).
    // Shown in footer + schema; must be prominent, not buried.
    independenceNote:
      'Independent visitor-information and ticket-booking service. ' +
      'Not operated by, or affiliated with, the official Bran Castle museum.',
  },

  // The attraction this site is about.
  // sameAs feeds E-E-A-T authority signals (SEO checklist item 20).
  // Include Wikipedia (EN + native language), Wikidata Q-id, official domain.
  attraction: {
    name: 'Bran Castle',
    alternateName: ["Castelul Bran", "Dracula's Castle", 'Törzburg'],
    latitude: 45.5149,
    longitude: 25.3672,
    sameAs: [
      'https://en.wikipedia.org/wiki/Bran_Castle',
      'https://ro.wikipedia.org/wiki/Castelul_Bran',
      'https://de.wikipedia.org/wiki/Schloss_Bran',
      'https://www.wikidata.org/wiki/Q184804',
      'https://www.bran-castle.com/',
    ],
  },

  // Set to "G-XXXXXXX" to enable GA4 once visitor consent is granted.
  // null = no-op; safe to leave null in development.
  ga4Id: null as string | null,

  // See ANALYTICS.md for the setup, consent hook, event catalog, and reporting SOP.
  // By default, analytics waits for an external consent manager to call
  // setAnalyticsConsent(true); this template does not include a consent banner.
  analytics: {
    consent: {
      required: true,
      storageKey: 'site-analytics-consent',
    },
    attribution: {
      // "session" is the privacy-conscious default. "first-touch" uses
      // localStorage for the configured number of days, after consent.
      persistence: 'session' as 'none' | 'session' | 'first-touch',
      retentionDays: 30,
      storageKey: 'site-attribution-v1',
      sessionStorageKey: 'site-analytics-session-v1',
    },
    destinations: {
      ga4: true,
      // Enable only when deployed with the Vercel Function and Log Drain.
      vercelAudit: false,
      auditEndpoint: '/api/analytics-event',
      auditEventNames: [
        'page_view',
        'ticket_select',
        'date_pick',
        'checkout_start',
        'quote_request_started',
        'email_signup_started',
      ],
    },
    funnelProfile: 'ticketing' as 'ticketing' | 'lead_generation' | 'custom',
  },

  // Add once a checkout / ticket page exists on a separate domain.
  // Used for a <link rel="preconnect"> hint.
  checkoutOrigin: null as string | null,
};

/**
 * Build an absolute URL for a path + language pair.
 * Always use this helper — never string-concatenate domains manually.
 *
 * @example urlFor('/faq', 'es') → "https://example.com/es/faq"
 * @example urlFor('/')          → "https://example.com/"
 */
export function urlFor(slug: string, lang = SITE.defaultLanguage): string {
  const cleanSlug =
    slug === '/' || slug === '' ? '' : `/${slug.replace(/^\//, '')}`;
  const path = `/${lang}${cleanSlug}`;
  return `${SITE.origin}${path || '/'}`;
}
