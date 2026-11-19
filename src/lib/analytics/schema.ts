export const CLIENT_EVENT_NAMES = [
  'page_view',
  'ticket_select',
  'date_pick',
  'checkout_start',
  'quote_request_started',
  'email_signup_started',
  'cta_click',
  'faq_open',
] as const;

export const SERVER_EVENT_NAMES = [
  'checkout_created',
  'purchase_confirmed',
  'checkout_failed',
  'quote_request_submitted',
  'email_signup_confirmed',
] as const;

export type ClientEventName = (typeof CLIENT_EVENT_NAMES)[number];
export type ServerEventName = (typeof SERVER_EVENT_NAMES)[number];
export type SourceMethod = 'utm' | 'referrer' | 'unknown';
export type AiSource =
  | 'chatgpt'
  | 'openai'
  | 'perplexity'
  | 'gemini'
  | 'claude'
  | 'copilot'
  | 'other_ai'
  | 'not_ai';

export interface UTMValues {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

export interface AttributionTouch {
  landingPath: string;
  landingAt: string;
  sourceMethod: SourceMethod;
  referrerDomain?: string;
  utm: UTMValues;
  aiSource: AiSource;
  aiEvidence: 'utm' | 'referrer' | 'none';
}

export interface AttributionContext {
  firstTouch: AttributionTouch;
  lastNonDirectTouch: AttributionTouch;
}

export type EventProperty = string | number | boolean;

export const FUNNEL_PROFILES = {
  ticketing: [
    'page_view',
    'ticket_select',
    'date_pick',
    'checkout_start',
    'purchase_confirmed',
  ],
  lead_generation: [
    'page_view',
    'quote_request_started',
    'quote_request_submitted',
    'email_signup_started',
    'email_signup_confirmed',
  ],
  custom: [],
} as const;

export interface AnalyticsEvent {
  eventId: string;
  eventName: ClientEventName;
  occurredAt: string;
  sessionId: string;
  routePath: string;
  sessionTouch: AttributionTouch;
  attribution: AttributionContext;
  properties: Record<string, EventProperty>;
}

const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const;

const EVENT_PROPERTY_KEYS: Record<ClientEventName, readonly string[]> = {
  page_view: [],
  ticket_select: ['ticket_id', 'audience', 'quantity'],
  date_pick: ['visit_date'],
  checkout_start: ['visit_date', 'visit_time', 'ticket_count'],
  quote_request_started: ['form_name'],
  email_signup_started: ['form_name'],
  cta_click: ['element_name'],
  faq_open: ['faq_id'],
};

const AI_UTM_SOURCES: Record<string, AiSource> = {
  chatgpt: 'chatgpt',
  chatgpt_com: 'chatgpt',
  openai: 'openai',
  openai_com: 'openai',
  perplexity: 'perplexity',
  perplexity_ai: 'perplexity',
  gemini: 'gemini',
  gemini_google_com: 'gemini',
  bard: 'gemini',
  claude: 'claude',
  claude_ai: 'claude',
  copilot: 'copilot',
  copilot_microsoft_com: 'copilot',
  bing_chat: 'copilot',
};

const AI_REFERRER_HOSTS: Array<[RegExp, AiSource]> = [
  [/(^|\.)chatgpt\.com$/i, 'chatgpt'],
  [/(^|\.)openai\.com$/i, 'openai'],
  [/(^|\.)perplexity\.ai$/i, 'perplexity'],
  [/(^|\.)gemini\.google\.com$/i, 'gemini'],
  [/(^|\.)bard\.google\.com$/i, 'gemini'],
  [/(^|\.)claude\.ai$/i, 'claude'],
  [/(^|\.)copilot\.microsoft\.com$/i, 'copilot'],
];

const KNOWN_CRAWLER =
  /bot|crawler|spider|slurp|preview|facebookexternalhit|whatsapp|telegrambot|discordbot|linkedinbot|google-inspectiontool/i;

export function sanitizePathname(path: string): string | null {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return null;
  try {
    const parsed = new URL(path, 'https://analytics.invalid');
    if (parsed.origin !== 'https://analytics.invalid') return null;
    return parsed.pathname.slice(0, 500);
  } catch {
    return null;
  }
}

function cleanValue(value: string | null): string | undefined {
  const cleaned = value?.trim().slice(0, 200);
  if (
    !cleaned ||
    /[?#]/.test(cleaned) ||
    containsSensitiveValue(cleaned)
  ) return undefined;
  return cleaned;
}

function containsSensitiveValue(value: string): boolean {
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value)) return true;
  if (/^\d{4}-\d{2}-\d{2}(?:[T ][0-9:.Z+-]+)?$/.test(value.trim())) return false;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 9 && /(?:\+?\d[\d\s().-]{7,}\d)/.test(value);
}

function getAiFromUtm(utm: UTMValues): AiSource {
  const source = utm.utm_source?.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  if (source && AI_UTM_SOURCES[source]) return AI_UTM_SOURCES[source];
  return source && /(^|_)(ai|llm|chatgpt|perplexity|gemini|claude)(_|$)/.test(source)
    ? 'other_ai'
    : 'not_ai';
}

function getAiFromReferrer(domain?: string): AiSource {
  if (!domain) return 'not_ai';
  return AI_REFERRER_HOSTS.find(([pattern]) => pattern.test(domain))?.[1] ?? 'not_ai';
}

export function parseLandingTouch(
  href: string,
  referrer: string,
  currentHostname: string,
  now = new Date(),
): AttributionTouch {
  const url = new URL(href, 'https://analytics.invalid');
  const landingPath = sanitizePathname(url.pathname) ?? '/';
  const utm = Object.fromEntries(
    UTM_KEYS.flatMap((key) => {
      const value = cleanValue(url.searchParams.get(key));
      return value ? [[key, value]] : [];
    }),
  ) as UTMValues;

  let referrerDomain: string | undefined;
  try {
    const hostname = referrer ? new URL(referrer).hostname.toLowerCase() : '';
    const normalizedReferrer = hostname.replace(/^www\./, '');
    const normalizedCurrent = currentHostname.toLowerCase().replace(/^www\./, '');
    if (normalizedReferrer && normalizedReferrer !== normalizedCurrent) {
      referrerDomain = normalizedReferrer.slice(0, 253);
    }
  } catch {
    // Invalid or non-URL referrers are not useful attribution evidence.
  }

  const sourceMethod: SourceMethod =
    Object.keys(utm).length > 0 ? 'utm' : referrerDomain ? 'referrer' : 'unknown';
  const aiSource =
    sourceMethod === 'utm'
      ? getAiFromUtm(utm)
      : sourceMethod === 'referrer'
        ? getAiFromReferrer(referrerDomain)
        : 'not_ai';

  return {
    landingPath,
    landingAt: now.toISOString(),
    sourceMethod,
    ...(referrerDomain ? { referrerDomain } : {}),
    utm,
    aiSource,
    aiEvidence:
      aiSource === 'not_ai'
        ? 'none'
        : sourceMethod === 'utm' || sourceMethod === 'referrer'
          ? sourceMethod
          : 'none',
  };
}

export function mergeAttribution(
  previous: AttributionContext | null,
  current: AttributionTouch,
): AttributionContext {
  if (!previous) return { firstTouch: current, lastNonDirectTouch: current };
  if (current.sourceMethod === 'unknown') return previous;
  return { firstTouch: previous.firstTouch, lastNonDirectTouch: current };
}

export function isKnownCrawlerUserAgent(userAgent: string): boolean {
  return KNOWN_CRAWLER.test(userAgent);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAttributionTouch(value: unknown): value is AttributionTouch {
  if (!isRecord(value)) return false;
  const path = sanitizePathname(String(value.landingPath ?? ''));
  if (
    !path ||
    value.landingPath !== path ||
    typeof value.landingAt !== 'string' ||
    !Number.isFinite(Date.parse(value.landingAt)) ||
    !['utm', 'referrer', 'unknown'].includes(String(value.sourceMethod)) ||
    !['chatgpt', 'openai', 'perplexity', 'gemini', 'claude', 'copilot', 'other_ai', 'not_ai'].includes(
      String(value.aiSource),
    ) ||
    !['utm', 'referrer', 'none'].includes(String(value.aiEvidence)) ||
    !isRecord(value.utm)
  ) return false;

  if (value.referrerDomain !== undefined && (
    typeof value.referrerDomain !== 'string' ||
    value.referrerDomain.length > 253 ||
    /[/?#@\s]/.test(value.referrerDomain)
  )) return false;

  return Object.entries(value.utm).every(
    ([key, entry]) =>
      UTM_KEYS.includes(key as (typeof UTM_KEYS)[number]) &&
      typeof entry === 'string' &&
      entry.length <= 200 &&
      !/[?#]/.test(entry) &&
      !containsSensitiveValue(entry),
  );
}

export function parseAttributionContext(value: unknown): AttributionContext | null {
  if (
    !isRecord(value) ||
    !isAttributionTouch(value.firstTouch) ||
    !isAttributionTouch(value.lastNonDirectTouch)
  ) return null;
  return value as unknown as AttributionContext;
}

const SENSITIVE_PROPERTY_KEY = /email|phone|name|address|ip|token|password|cookie|order.?id|user.?id/i;

function isSafeProperties(
  eventName: ClientEventName,
  value: unknown,
): value is Record<string, EventProperty> {
  if (!isRecord(value) || Object.keys(value).length > 12) return false;
  return Object.entries(value).every(([key, entry]) => {
    if (
      !EVENT_PROPERTY_KEYS[eventName].includes(key) ||
      !/^[a-z][a-z0-9_]{0,39}$/i.test(key) ||
      SENSITIVE_PROPERTY_KEY.test(key)
    ) return false;
    if (typeof entry === 'string') {
      return entry.length <= 160 && !/[?#]/.test(entry) && !containsSensitiveValue(entry);
    }
    return typeof entry === 'boolean' || (typeof entry === 'number' && Number.isFinite(entry));
  });
}

export function parseClientAnalyticsEvent(value: unknown): AnalyticsEvent | null {
  if (!isRecord(value)) return null;
  const routePath = sanitizePathname(String(value.routePath ?? ''));
  if (
    typeof value.eventId !== 'string' ||
    !/^[a-zA-Z0-9_-]{8,80}$/.test(value.eventId) ||
    !CLIENT_EVENT_NAMES.includes(value.eventName as ClientEventName) ||
    typeof value.occurredAt !== 'string' ||
    !Number.isFinite(Date.parse(value.occurredAt)) ||
    typeof value.sessionId !== 'string' ||
    !/^[a-zA-Z0-9_-]{8,80}$/.test(value.sessionId) ||
    !routePath ||
    value.routePath !== routePath ||
    !isAttributionTouch(value.sessionTouch) ||
    !parseAttributionContext(value.attribution) ||
    !isSafeProperties(value.eventName as ClientEventName, value.properties)
  ) return null;

  return value as unknown as AnalyticsEvent;
}
