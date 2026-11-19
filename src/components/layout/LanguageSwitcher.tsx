'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useI18n, locales } from '@/i18n/I18nContext';
import { getArticleLocalePathsForPath } from '@/lib/article-routes';
import { Globe, ChevronDown } from 'lucide-react';

const LOCALE_NAMES: Record<string, string> = {
  en: "English",
  es: "Español",
  ro: "Română",
  pt: "Português",
  it: "Italiano",
  fr: "Français",
  pl: "Polski",
  de: "Deutsch",
  nl: "Nederlands",
  el: "Ελληνικά",
  ru: "Русский",
  ko: "한국어",
  ja: "日本語",
  zh: "中文",
};

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  const pathname = usePathname();
  const articlePaths = getArticleLocalePathsForPath(pathname);
  const availableLocales = articlePaths ? Object.keys(articlePaths) : locales;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-sm font-semibold hover:opacity-75 transition-opacity"
        aria-label="Switch language"
      >
        <Globe className="w-4 h-4" />
        <span className="uppercase">{locale}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 rounded-xl shadow-xl border bg-popover text-popover-foreground overflow-hidden z-50">
          <div className="py-1 max-h-[60vh] overflow-y-auto">
            {availableLocales.map((loc) => (
              <button
                key={loc}
                onClick={() => {
                  setLocale(loc);
                  setOpen(false);
                }}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors flex items-center justify-between"
                style={{ fontWeight: loc === locale ? 'bold' : 'normal' }}
              >
                {LOCALE_NAMES[loc]}
                {loc === locale && <span className="w-2 h-2 rounded-full bg-primary" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
