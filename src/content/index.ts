export * from './en/event';

import { eventConfig as en } from './en/event';
import type { EventConfig } from './en/event';

const eventConfigs: Record<string, EventConfig> = { en };
export const eventContentLocales = Object.keys(eventConfigs);
export function getEventContentLocale(locale: string) {
  return eventContentLocales.includes(locale) ? locale : 'en';
}

export function getEventConfig(locale: string) {
  // Only English event copy is supplied. Other locales explicitly use English
  // content with translated UI; they are not advertised as translated pages.
  return eventConfigs[locale] ?? en;
}
