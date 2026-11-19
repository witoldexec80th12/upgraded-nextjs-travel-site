import { eventConfig } from './event';
import type { Package } from '@/lib/packages';

/** The existing template's ticket collection; replace with this site's catalog. */
export const packages: Package[] = [{
  slug: 'castle-tickets',
  title: eventConfig.hero.title,
  description: eventConfig.hero.subtitle,
  image: eventConfig.hero.heroImage,
  tickets: eventConfig.ticketTypes,
  contentLocale: 'en',
}];
