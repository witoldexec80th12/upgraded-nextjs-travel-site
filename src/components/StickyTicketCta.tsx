'use client';

import { useState, useMemo } from 'react';
import { useLocation } from '@/lib/navigation';
import { SITE } from '@/config/site';
import { getDefaultPackage } from '@/lib/packages';
import { Minus, Plus, X } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import { getEventConfig } from '@/content';

function Counter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground leading-none">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={value <= 0}
          className="w-8 h-8 rounded-md border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-40"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <span className="w-5 text-center font-bold text-base">{value}</span>
        <button
          onClick={() => onChange(value + 1)}
          className="w-8 h-8 rounded-md border flex items-center justify-center hover:bg-muted transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function StickyTicketCta() {
  const { locale, t } = useI18n();
  const config = getEventConfig(locale);
  const ticketTypes = getDefaultPackage(locale).tickets;
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);

  const [quantities, setQuantities] = useState<Record<string, { adults: number; children: number }>>(
    () => Object.fromEntries(ticketTypes.map((tk) => [tk.id, { adults: 0, children: 0 }]))
  );

  const totalTickets = useMemo(
    () => Object.values(quantities).reduce((sum, q) => sum + q.adults + q.children, 0),
    [quantities]
  );

  const handleBuy = () => {
    if (totalTickets === 0) return;
    const params = new URLSearchParams();
    Object.entries(quantities).forEach(([id, q]) => {
      if (q.adults > 0) params.set(`${id}_adults`, String(q.adults));
      if (q.children > 0) params.set(`${id}_children`, String(q.children));
    });
    setLocation(`/booking/${SITE.defaultPackage}?${params.toString()}`);
  };

  const primaryHsl = `hsl(${config.brand.colors.primary})`;
  const primaryFgHsl = `hsl(${config.brand.colors.primaryForeground})`;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        className="fixed inset-0 z-40 bg-black/30 transition-opacity duration-300"
        style={{ opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ease-out"
        style={{ transform: open ? 'translateY(0)' : 'translateY(calc(100% - 68px))' }}
      >
        {/* Collapsed bar (always visible) */}
        <div
          className="flex items-center justify-between gap-4 px-5 h-[68px] cursor-pointer select-none"
          style={{ backgroundColor: `hsl(${config.brand.colors.background})`, borderTop: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 -4px 24px rgba(0,0,0,0.10)' }}
          onClick={() => setOpen(!open)}
        >
          <p className="text-xs text-muted-foreground leading-snug line-clamp-2 flex-1 hidden sm:block">
            {config.faq.mandatoryNote}
          </p>
          <button
            data-track="article_sticky_cta"
            onClick={(e) => { e.stopPropagation(); setOpen(true); }}
            className="shrink-0 px-6 py-2.5 rounded-lg font-semibold text-sm transition-opacity hover:opacity-90"
            style={{ backgroundColor: primaryHsl, color: primaryFgHsl }}
          >
            {t('booking.buyTickets') || 'Purchase Tickets'}
          </button>
        </div>

        {/* Expanded panel */}
        <div
          style={{ backgroundColor: `hsl(${config.brand.colors.background})` }}
          className="border-t"
        >
          {/* Handle + header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <div className="mx-auto absolute left-1/2 -translate-x-1/2 top-2 w-10 h-1 rounded-full bg-muted-foreground/30" />
            <h2 className="font-serif text-xl font-bold">{t('booking.sectionTitle') || 'Tickets'}</h2>
            <button
              onClick={() => setOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Ticket cards */}
          <div className="px-5 pb-4 space-y-3 max-h-[55vh] overflow-y-auto">
            {ticketTypes.map((ticket) => (
              <div
                key={ticket.id}
                className="rounded-xl border p-4"
                style={{ backgroundColor: `hsl(${config.brand.colors.primary} / 0.05)` }}
              >
                <p className="font-semibold text-base mb-0.5">{ticket.title}</p>
                <p className="text-xs text-muted-foreground mb-4">
                  €{ticket.adultPrice} adult · Child &lt;5yr (Free) free
                </p>
                <div className="flex flex-wrap gap-6">
                  <Counter
                    label={`${t('booking.adult') || 'Adult'} €${ticket.adultPrice}`}
                    value={quantities[ticket.id].adults}
                    onChange={(n) =>
                      setQuantities((p) => ({ ...p, [ticket.id]: { ...p[ticket.id], adults: n } }))
                    }
                  />
                  {ticket.childPrice === 0 ? (
                    <Counter
                      label={`Child <5yr (Free)`}
                      value={quantities[ticket.id].children}
                      onChange={(n) =>
                        setQuantities((p) => ({ ...p, [ticket.id]: { ...p[ticket.id], children: n } }))
                      }
                    />
                  ) : (
                    <Counter
                      label={`${t('booking.child') || 'Child'} €${ticket.childPrice}`}
                      value={quantities[ticket.id].children}
                      onChange={(n) =>
                        setQuantities((p) => ({ ...p, [ticket.id]: { ...p[ticket.id], children: n } }))
                      }
                    />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Buy button */}
          <div className="px-5 pb-6">
            <button
              onClick={handleBuy}
              disabled={totalTickets === 0}
              className="w-full py-4 rounded-xl font-bold text-base transition-opacity disabled:opacity-50"
              style={{ backgroundColor: primaryHsl, color: primaryFgHsl }}
            >
              {t('booking.buyTickets') || 'Purchase Tickets'}
            </button>
          </div>
        </div>
      </div>

      {/* Bottom spacer so page content isn't hidden under the bar */}
      <div className="h-[68px]" />
    </>
  );
}
