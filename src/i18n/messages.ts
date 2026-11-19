import en from '@/content/en/messages.json';
import es from '@/content/es/messages.json';
import pt from '@/content/pt/messages.json';
import it from '@/content/it/messages.json';
import fr from '@/content/fr/messages.json';
import pl from '@/content/pl/messages.json';
import de from '@/content/de/messages.json';
import nl from '@/content/nl/messages.json';
import el from '@/content/el/messages.json';
import ru from '@/content/ru/messages.json';
import ko from '@/content/ko/messages.json';
import ja from '@/content/ja/messages.json';
import zh from '@/content/zh/messages.json';

export type Messages = Record<string, any>;
const messages: Record<string, Messages> = { en, es, pt, it, fr, pl, de, nl, el, ru, ko, ja, zh };

export function getMessages(locale: string): Messages {
  return messages[locale] ?? en;
}

export function translate(messages: Messages, key: string, variables?: Record<string, string | number>): string {
  const value = key.split('.').reduce<any>((result, part) => result?.[part], messages);
  if (typeof value !== 'string') return key;
  return Object.entries(variables ?? {}).reduce(
    (text, [name, replacement]) => text.replaceAll(`{${name}}`, String(replacement)), value,
  );
}
