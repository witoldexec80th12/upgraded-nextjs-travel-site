import assert from 'node:assert/strict';
import {
  CLIENT_EVENT_NAMES,
  FUNNEL_PROFILES,
  isKnownCrawlerUserAgent,
  mergeAttribution,
  parseClientAnalyticsEvent,
  parseLandingTouch,
  sanitizePathname,
} from '../src/lib/analytics/schema';

const now = new Date('2026-11-04T09:00:00.000Z');
const campaignLanding = parseLandingTouch(
  'https://example.com/schedule?utm_source=chatgpt.com&utm_medium=referral&utm_campaign=autumn&utm_content=card&utm_term=castle#times',
  'https://www.google.com/search?q=castle',
  'example.com',
  now,
);

assert.equal(campaignLanding.landingPath, '/schedule');
assert.equal(campaignLanding.landingAt, now.toISOString());
assert.equal(campaignLanding.sourceMethod, 'utm');
assert.equal(campaignLanding.referrerDomain, 'google.com');
assert.equal(campaignLanding.aiSource, 'chatgpt');
assert.equal(campaignLanding.aiEvidence, 'utm');
assert.deepEqual(campaignLanding.utm, {
  utm_source: 'chatgpt.com',
  utm_medium: 'referral',
  utm_campaign: 'autumn',
  utm_content: 'card',
  utm_term: 'castle',
});

const referrerLanding = parseLandingTouch(
  'https://example.com/faq',
  'https://www.perplexity.ai/search?query=bran',
  'example.com',
  now,
);
assert.equal(referrerLanding.sourceMethod, 'referrer');
assert.equal(referrerLanding.referrerDomain, 'perplexity.ai');
assert.equal(referrerLanding.aiSource, 'perplexity');
assert.equal(referrerLanding.aiEvidence, 'referrer');

const directLanding = parseLandingTouch(
  'https://example.com/',
  'https://www.example.com/another-page',
  'example.com',
  now,
);
assert.equal(directLanding.sourceMethod, 'unknown');
assert.equal(directLanding.referrerDomain, undefined);
assert.equal(directLanding.aiSource, 'not_ai');

const unsafeCampaign = parseLandingTouch(
  'https://example.com/?utm_source=visitor%40example.com',
  '',
  'example.com',
  now,
);
assert.equal(unsafeCampaign.sourceMethod, 'unknown');
assert.deepEqual(unsafeCampaign.utm, {});

assert.equal(sanitizePathname('/article/queen?token=private#section'), '/article/queen');
assert.equal(sanitizePathname('//outside.example/path'), null);
assert.equal(isKnownCrawlerUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1)'), true);
assert.equal(isKnownCrawlerUserAgent('Mozilla/5.0 (X11; Linux x86_64)'), false);

const laterTouch = parseLandingTouch(
  'https://example.com/guide?utm_source=newsletter',
  '',
  'example.com',
  new Date('2026-11-05T10:00:00.000Z'),
);
const merged = mergeAttribution(
  { firstTouch: campaignLanding, lastNonDirectTouch: campaignLanding },
  laterTouch,
);
assert.equal(merged.firstTouch.landingPath, '/schedule');
assert.equal(merged.lastNonDirectTouch.utm.utm_source, 'newsletter');
assert.equal(
  mergeAttribution(merged, directLanding).lastNonDirectTouch.utm.utm_source,
  'newsletter',
);

const validEvent = {
  eventId: 'event_12345678',
  eventName: 'date_pick',
  occurredAt: now.toISOString(),
  sessionId: 'session_12345678',
  routePath: '/schedule',
  sessionTouch: campaignLanding,
  attribution: { firstTouch: campaignLanding, lastNonDirectTouch: campaignLanding },
  properties: { visit_date: '2026-11-10' },
};
assert.equal(parseClientAnalyticsEvent(validEvent)?.eventName, 'date_pick');
assert.equal(
  parseClientAnalyticsEvent({ ...validEvent, routePath: '/schedule?email=private' }),
  null,
);
assert.equal(
  parseClientAnalyticsEvent({ ...validEvent, eventName: 'purchase_confirmed' }),
  null,
);
assert.equal(
  parseClientAnalyticsEvent({
    ...validEvent,
    properties: { visit_date: '2026-11-10', email: 'visitor@example.com' },
  }),
  null,
);
assert.equal(
  parseClientAnalyticsEvent({
    ...validEvent,
    properties: { visit_date: '2026-11-10', arbitrary_payload: 'not allowed' },
  }),
  null,
);
assert.equal(
  parseClientAnalyticsEvent({
    ...validEvent,
    attribution: {
      firstTouch: { ...campaignLanding, landingPath: '/?secret=query' },
      lastNonDirectTouch: campaignLanding,
    },
  }),
  null,
);

assert.deepEqual(FUNNEL_PROFILES.ticketing, [
  'page_view',
  'ticket_select',
  'date_pick',
  'checkout_start',
  'purchase_confirmed',
]);
assert.ok(CLIENT_EVENT_NAMES.includes('checkout_start'));

console.log('Analytics schema tests passed.');
