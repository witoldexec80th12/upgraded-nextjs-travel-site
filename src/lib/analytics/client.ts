import { SITE } from '@/config/site';
import {
  mergeAttribution,
  parseAttributionContext,
  parseLandingTouch,
  sanitizePathname,
  type AnalyticsEvent,
  type AttributionContext,
  type ClientEventName,
  type EventProperty,
} from './schema';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gtag?: (...args: any[]) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dataLayer?: any[];
  }
}

const CONSENT_EVENT = 'site-analytics-consent-change';
let currentTouch:
  | ReturnType<typeof parseLandingTouch>
  | null = null;
let attributionContext: AttributionContext | null = null;
let sessionId: string | null = null;
let initialized = false;
let consentOverride: boolean | null = null;

function randomId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function storage(kind: 'localStorage' | 'sessionStorage'): Storage | null {
  try {
    return window[kind];
  } catch {
    return null;
  }
}

function storedConsent(): boolean {
  if (consentOverride !== null) return consentOverride;
  if (!SITE.analytics.consent.required) return true;
  try {
    return window.localStorage.getItem(SITE.analytics.consent.storageKey) === 'granted';
  } catch {
    return false;
  }
}

export function hasAnalyticsConsent(): boolean {
  return typeof window !== 'undefined' && storedConsent();
}

function captureCurrentTouch(): NonNullable<typeof currentTouch> {
  if (!currentTouch) {
    currentTouch = parseLandingTouch(
      window.location.href,
      document.referrer,
      window.location.hostname,
    );
  }
  return currentTouch;
}

function readSavedAttribution(): AttributionContext | null {
  if (SITE.analytics.attribution.persistence === 'none') return null;
  const storageKind =
    SITE.analytics.attribution.persistence === 'first-touch' ? 'localStorage' : 'sessionStorage';
  try {
    const serialized = storage(storageKind)?.getItem(SITE.analytics.attribution.storageKey);
    if (!serialized) return null;
    const parsed = JSON.parse(serialized) as { context?: unknown };
    const context = parseAttributionContext(parsed.context);
    if (!context) return null;
    if (
      SITE.analytics.attribution.persistence === 'first-touch' &&
      Date.now() - Date.parse(context.lastNonDirectTouch.landingAt) >
        SITE.analytics.attribution.retentionDays * 86400000
    ) return null;
    return context;
  } catch {
    return null;
  }
}

function saveAttribution(context: AttributionContext): void {
  if (SITE.analytics.attribution.persistence === 'none') return;
  const storageKind =
    SITE.analytics.attribution.persistence === 'first-touch' ? 'localStorage' : 'sessionStorage';
  try {
    storage(storageKind)?.setItem(
      SITE.analytics.attribution.storageKey,
      JSON.stringify({ context }),
    );
  } catch {
    // Analytics remains functional for this page view when browser storage is unavailable.
  }
}

function resolveAttribution(): AttributionContext {
  if (!attributionContext) {
    attributionContext = mergeAttribution(readSavedAttribution(), captureCurrentTouch());
    saveAttribution(attributionContext);
  }
  return attributionContext;
}

function getSessionId(): string {
  if (sessionId) return sessionId;
  const sessionStorage = storage('sessionStorage');
  const key = SITE.analytics.attribution.sessionStorageKey;
  try {
    sessionId = sessionStorage?.getItem(key) ?? null;
  } catch {
    sessionId = null;
  }
  if (!sessionId) {
    sessionId = randomId();
    try {
      sessionStorage?.setItem(key, sessionId);
    } catch {
      // Keep the in-memory session ID for this page if storage is disabled.
    }
  }
  return sessionId;
}

function initializeGa4(): void {
  if (!SITE.analytics.destinations.ga4 || !SITE.ga4Id || window.gtag) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    window.dataLayer!.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('consent', 'update', { analytics_storage: 'granted' });
  window.gtag('config', SITE.ga4Id, { send_page_view: false });

  const script = document.createElement('script');
  script.id = 'ga4-script';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(SITE.ga4Id)}`;
  document.head.appendChild(script);
}

export function initializeAnalytics(): void {
  if (typeof window === 'undefined' || !hasAnalyticsConsent()) return;
  captureCurrentTouch();
  resolveAttribution();
  getSessionId();
  initializeGa4();
  initialized = true;
}

export function setAnalyticsConsent(granted: boolean): void {
  if (typeof window === 'undefined') return;
  consentOverride = granted;
  try {
    window.localStorage.setItem(
      SITE.analytics.consent.storageKey,
      granted ? 'granted' : 'denied',
    );
  } catch {
    // Current-tab consent still applies when storage is unavailable.
  }

  if (granted) {
    initializeAnalytics();
  } else {
    initialized = false;
    attributionContext = null;
    sessionId = null;
    for (const storageKind of ['localStorage', 'sessionStorage'] as const) {
      try {
        storage(storageKind)?.removeItem(SITE.analytics.attribution.storageKey);
        storage(storageKind)?.removeItem(SITE.analytics.attribution.sessionStorageKey);
      } catch {
        // Revocation still disables event dispatch in memory.
      }
    }
    window.gtag?.('consent', 'update', { analytics_storage: 'denied' });
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: { granted } }));
}

function attributionParameters(context: AttributionContext): Record<string, string> {
  const first = context.firstTouch;
  const recent = context.lastNonDirectTouch;
  const session = captureCurrentTouch();
  return {
    source_method: recent.sourceMethod,
    landing_path: first.landingPath,
    landing_timestamp: first.landingAt,
    ai_source: recent.aiSource,
    ai_evidence: recent.aiEvidence,
    ...(recent.referrerDomain ? { referrer_domain: recent.referrerDomain } : {}),
    ...recent.utm,
    first_touch_source_method: first.sourceMethod,
    first_touch_ai_source: first.aiSource,
    first_touch_landing_path: first.landingPath,
    session_source_method: session.sourceMethod,
    session_landing_path: session.landingPath,
    session_landing_timestamp: session.landingAt,
    session_ai_source: session.aiSource,
    session_ai_evidence: session.aiEvidence,
    ...(session.referrerDomain
      ? { session_referrer_domain: session.referrerDomain }
      : {}),
    ...Object.fromEntries(
      Object.entries(session.utm).map(([key, value]) => [`session_${key}`, value]),
    ),
    ...(first.referrerDomain ? { first_touch_referrer_domain: first.referrerDomain } : {}),
    ...Object.fromEntries(
      Object.entries(first.utm).map(([key, value]) => [`first_touch_${key}`, value]),
    ),
  };
}

export function trackEvent(
  eventName: ClientEventName,
  properties: Record<string, EventProperty> = {},
): void {
  if (!initialized || !hasAnalyticsConsent()) return;
  const routePath = sanitizePathname(window.location.pathname) ?? '/';
  const event: AnalyticsEvent = {
    eventId: randomId(),
    eventName,
    occurredAt: new Date().toISOString(),
    sessionId: getSessionId(),
    routePath,
    sessionTouch: captureCurrentTouch(),
    attribution: resolveAttribution(),
    properties,
  };
  const contextParams = attributionParameters(event.attribution);
  const gaParams = {
    ...contextParams,
    ...properties,
    page_path: routePath,
    site_event_id: event.eventId,
    site_session_id: event.sessionId,
  };
  if (SITE.analytics.destinations.ga4 && SITE.ga4Id) {
    window.gtag?.(
      'event',
      eventName,
      eventName === 'page_view'
        ? { ...gaParams, page_location: `${window.location.origin}${routePath}` }
        : gaParams,
    );
  }

  if (
    SITE.analytics.destinations.vercelAudit &&
    SITE.analytics.destinations.auditEventNames.includes(eventName)
  ) {
    void fetch(SITE.analytics.destinations.auditEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(event),
      keepalive: true,
      credentials: 'same-origin',
    }).catch(() => {
      // Audit logging is optional and must not interrupt a visitor action.
    });
  }
}

export function getConsentChangeEventName(): string {
  return CONSENT_EVENT;
}
