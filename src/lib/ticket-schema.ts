/**
 * ticket-schema.ts
 *
 * Exports:
 *  - REFUND_POLICY — the single canonical refund-policy string. Used in:
 *      1. Offer.description (below)
 *      2. MerchantReturnPolicy.description (below)
 *      3. The FAQ answer in event.en.ts (imported and used directly)
 *    All three must be character-for-character identical — validators diff them.
 *
 *  - buildTicketJsonLd(config) — returns a Product node with AggregateOffer
 *    containing one Offer per ticket × price tier.
 *    Injected on the HOME PAGE ONLY via extraJsonLdNodes.
 *    Must never appear on article or FAQ routes.
 */

import { SITE } from '../config/site';
import type { EventConfig } from '../content/event.en';

// ── REFUND_POLICY — single source of truth ────────────────────────────────────
// Update this string and every usage (Offer.description, MerchantReturnPolicy,
// FAQ answer) automatically stays in sync — there is only one definition.
export const REFUND_POLICY =
  'Tickets are non-refundable. Date changes are permitted free of charge up to 24 hours before your visit date by contacting us.';

// ── buildTicketJsonLd ─────────────────────────────────────────────────────────

export function buildTicketJsonLd(config: EventConfig): object {
  const origin         = SITE.origin;
  const orgId          = `${origin}/#organization`;
  const productId      = `${origin}/#ticket-product`;
  const returnPolicyId = `${origin}/#return-policy`;
  const ticketsUrl     = `${origin}/${SITE.defaultLanguage}`;
  const scheduleUrl    = `${origin}/${SITE.defaultLanguage}/booking/${SITE.defaultPackage}`;

  const offerNodes: object[] = [];
  let lowPrice  = Infinity;
  let highPrice = -Infinity;

  for (const ticket of config.ticketTypes) {
    // Helper to build a single Offer node
    const makeOffer = (tier: 'adult' | 'child', price: number, label: string): object => ({
      '@type': 'Offer',
      '@id': `${origin}/#offer-${ticket.id}-${tier}`,
      name: `${ticket.title} – ${label}`,
      price,
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
      url: ticketsUrl,
      description: REFUND_POLICY,
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        '@id': returnPolicyId,
        returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted',
        merchantReturnLink: ticketsUrl,
        description: REFUND_POLICY,
      },
      seller: { '@type': 'Organization', '@id': orgId },
      potentialAction: {
        '@type': 'ReserveAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: scheduleUrl,
          actionPlatform: [
            'http://schema.org/DesktopWebPlatform',
            'http://schema.org/MobileWebPlatform',
          ],
        },
        result: {
          '@type': 'Reservation',
          name: `${ticket.title} Reservation`,
        },
      },
    });

    // Adult offer
    offerNodes.push(makeOffer('adult', ticket.adultPrice, 'Adult'));
    lowPrice  = Math.min(lowPrice, ticket.adultPrice);
    highPrice = Math.max(highPrice, ticket.adultPrice);

    // Child offer (include even if free — schema validators expect both tiers)
    const childLabel = ticket.childPrice === 0 ? 'Child (Free)' : 'Child';
    offerNodes.push(makeOffer('child', ticket.childPrice, childLabel));
    if (ticket.childPrice > 0) {
      lowPrice  = Math.min(lowPrice, ticket.childPrice);
      highPrice = Math.max(highPrice, ticket.childPrice);
    }
  }

  const aggregateOffer = {
    '@type': 'AggregateOffer',
    priceCurrency: 'EUR',
    lowPrice:   lowPrice  === Infinity  ? 0 : lowPrice,
    highPrice:  highPrice === -Infinity ? 0 : highPrice,
    offerCount: offerNodes.length,
    offers: offerNodes,
  };

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': productId,
    name: config.brand.name,
    description: config.hero.subtitle,
    url: ticketsUrl,
    image: `${origin}${config.hero.heroImage}`,
    brand: {
      '@type': 'Organization',
      '@id': orgId,
    },
    offers: aggregateOffer,
  };
}
