'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import {
  getConsentChangeEventName,
  hasAnalyticsConsent,
  trackEvent,
  initializeAnalytics,
} from '@/lib/analytics/client';
import { sanitizePathname } from '@/lib/analytics/schema';

/**
 * Mount inside Wouter so route changes can be measured as SPA page views.
 * Only pathname changes count; query-string and hash-only updates are ignored.
 */
export function Analytics() {
  const location = usePathname();
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    initializeAnalytics();
    const trackRoute = () => {
      if (!hasAnalyticsConsent()) return;
      const path = sanitizePathname(window.location.pathname) ?? '/';
      if (path === lastTrackedPath.current) return;
      lastTrackedPath.current = path;
      trackEvent('page_view');
    };

    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const element = target.closest<HTMLElement>('[data-track]');
      const label = element?.dataset.track;
      if (label) trackEvent('cta_click', { element_name: label });
    };

    const handleConsentChange = (event: Event) => {
      const granted = (event as CustomEvent<{ granted?: boolean }>).detail?.granted;
      if (granted) trackRoute();
      else lastTrackedPath.current = null;
    };

    document.addEventListener('click', handleClick);
    window.addEventListener(getConsentChangeEventName(), handleConsentChange);
    trackRoute();
    return () => {
      document.removeEventListener('click', handleClick);
      window.removeEventListener(getConsentChangeEventName(), handleConsentChange);
    };
  }, [location]);

  return null;
}
