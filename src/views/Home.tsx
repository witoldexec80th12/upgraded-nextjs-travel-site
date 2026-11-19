'use client';

import { useState, useMemo } from 'react';
import { Link, useLocation } from '@/lib/navigation';
import { useI18n } from '@/i18n/I18nContext';
import { getEventConfig } from '@/content';
import { PageLayout } from '@/components/layout/PageLayout';
import { articles as registeredArticles } from '@/data/articles/index';
import { Minus, Plus, MapPin, Map, Bus, Info, AlertCircle, ShieldCheck } from 'lucide-react';
import { SITE } from '@/config/site';
import { trackEvent } from '@/lib/analytics/client';
import { getDefaultPackage } from '@/lib/packages';

function Counter({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs font-bold tracking-widest uppercase text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <button 
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-8 h-8 rounded-md border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-50"
          disabled={value <= 0}
        >
          <Minus className="w-4 h-4" />
        </button>
        <span className="w-6 text-center font-bold text-lg">{value}</span>
        <button 
          onClick={() => onChange(value + 1)}
          className="w-8 h-8 rounded-md border flex items-center justify-center hover:bg-muted transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const { locale, t } = useI18n();
  const config = getEventConfig(locale);
  const ticketTypes = getDefaultPackage(locale).tickets;
  const [, setLocation] = useLocation();

  const [quantities, setQuantities] = useState<Record<string, { adults: number; children: number }>>(() => 
    Object.fromEntries(ticketTypes.map(tk => [tk.id, { adults: 0, children: 0 }]))
  );

  const totalTickets = useMemo(() => {
    return Object.values(quantities).reduce((sum, q) => sum + q.adults + q.children, 0);
  }, [quantities]);

  const handleBuy = () => {
    if (totalTickets === 0) {
      const el = document.getElementById('tickets');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    const params = new URLSearchParams();
    Object.entries(quantities).forEach(([id, q]) => {
      if (q.adults > 0) params.set(`${id}_adults`, String(q.adults));
      if (q.children > 0) params.set(`${id}_children`, String(q.children));
    });
    setLocation(`/booking/${SITE.defaultPackage}?${params.toString()}`);
  };

  return (
    <PageLayout>
      {/* Hero Section */}
      <section className="relative w-full h-[60vh] min-h-[400px] flex flex-col items-center justify-center overflow-hidden">
        <img 
          src={config.hero.heroImage} 
          alt={config.hero.title} 
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto flex flex-col items-center">
          <span className="inline-block px-4 py-1.5 mb-6 text-xs font-bold tracking-widest uppercase rounded-full bg-white/20 backdrop-blur-md text-white border border-white/30">
            {config.hero.badge}
          </span>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif font-bold text-white mb-6 drop-shadow-lg leading-tight">
            {config.hero.title}
          </h1>
          <p className="text-lg md:text-xl text-white/90 mb-10 max-w-2xl drop-shadow-md">
            {config.hero.subtitle}
          </p>
          <a 
            href="#tickets"
            data-track="home_hero_cta"
            className="px-8 py-4 rounded-xl font-bold text-lg transition-transform hover:scale-105 shadow-xl"
            style={{ backgroundColor: `hsl(${config.brand.colors.accent})`, color: `hsl(${config.brand.colors.foreground})` }}
          >
            {config.hero.ctaLabel}
          </a>
        </div>
      </section>

      {/* Tickets Section */}
      <section id="tickets" className="py-20 px-6 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <div className="mb-12 text-center">
            <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">{t('booking.sectionTitle')}</h2>
            <p className="text-muted-foreground flex items-center justify-center gap-2">
              <Info className="w-4 h-4" /> {config.faq.mandatoryNote}
            </p>
          </div>

          {/* Independence disclosure — prominent above ticket cards */}
          <div className="mb-8 p-4 rounded-xl border bg-primary/5 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground leading-relaxed">{SITE.organization.independenceNote}</p>
          </div>
          
          <p className="mb-5 text-center">
            <Link href={`/tours/${SITE.defaultPackage}`} className="underline underline-offset-4">View package details</Link>
          </p>
          <div className="grid gap-8">
            {/* Recommended tickets rendered first via sort */}
            {[...ticketTypes]
              .sort((a, b) => (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0))
              .map((ticket) => (
              <div
                key={ticket.id}
                className={`bg-card rounded-2xl overflow-hidden shadow-lg flex flex-col md:flex-row transition-shadow hover:shadow-xl ${ticket.recommended ? 'border-2' : 'border'}`}
                style={ticket.recommended ? { borderColor: `hsl(${config.brand.colors.accent})` } : undefined}
              >
                {ticket.recommended && (
                  <div
                    className="absolute hidden md:block"
                    style={{ position: 'relative' }}
                  >
                    {/* Most Popular badge overlaid on top-right of the card */}
                  </div>
                )}
                <div className="w-full md:w-1/3 h-48 md:h-auto relative">
                  <img src={ticket.image} alt={ticket.title} className="absolute inset-0 w-full h-full object-cover" />
                  {ticket.recommended && (
                    <span
                      className="absolute top-3 left-3 px-3 py-1 text-xs font-bold uppercase tracking-widest rounded-full shadow"
                      style={{ backgroundColor: `hsl(${config.brand.colors.accent})`, color: `hsl(${config.brand.colors.foreground})` }}
                    >
                      Most Popular
                    </span>
                  )}
                </div>
                <div className="flex-1 p-6 md:p-8 flex flex-col justify-between">
                  <div>
                    <h3 className="text-2xl font-bold mb-2 text-foreground">{ticket.title}</h3>
                    <p className="text-muted-foreground mb-4 leading-relaxed">{ticket.details}</p>
                    <p className="text-sm font-medium text-primary bg-primary/10 inline-block px-3 py-1 rounded-md mb-4">{ticket.hours}</p>
                    {/* Adult / child price breakdown — visible without expanding */}
                    <div className="flex gap-4 text-sm text-muted-foreground mb-2">
                      <span><strong className="text-foreground">Adult</strong> €{ticket.adultPrice}</span>
                      <span>·</span>
                      <span><strong className="text-foreground">Child</strong> {ticket.childPrice === 0 ? 'Free' : `€${ticket.childPrice}`}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-8 pt-6 border-t">
                    <Counter 
                      label={`${t('booking.adult')} (€${ticket.adultPrice})`}
                      value={quantities[ticket.id].adults}
                      onChange={(n) => {
                        if (n === quantities[ticket.id].adults) return;
                        setQuantities(p => ({ ...p, [ticket.id]: { ...p[ticket.id], adults: n }}));
                        trackEvent('ticket_select', {
                          ticket_id: ticket.id,
                          audience: 'adult',
                          quantity: n,
                        });
                      }}
                    />
                    <Counter 
                      label={ticket.childPrice === 0 ? `${t('booking.child')} (Free)` : `${t('booking.child')} (€${ticket.childPrice})`}
                      value={quantities[ticket.id].children}
                      onChange={(n) => {
                        if (n === quantities[ticket.id].children) return;
                        setQuantities(p => ({ ...p, [ticket.id]: { ...p[ticket.id], children: n }}));
                        trackEvent('ticket_select', {
                          ticket_id: ticket.id,
                          audience: 'child',
                          quantity: n,
                        });
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Honest scarcity signal — only shown when config.scarcityNote is set.
              Only set this field if the statement is factually true for your venue. */}
          {config.scarcityNote && (
            <div className="mt-6 flex items-start gap-2 text-sm text-muted-foreground">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
              <p>{config.scarcityNote}</p>
            </div>
          )}

          {/* Trust signals — social proof placeholder.
              TODO: Replace with verified, permissioned reviews before launch —
              fabricated reviews violate consumer law (EU Omnibus Directive /
              UK CMA guidance, items 49–54) and may expose you to enforcement action.
              Do not display this section until you have real, sourced testimonials. */}
          <div className="mt-10 pt-8 border-t">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
              What visitors say
            </p>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { quote: '[Replace with a real verified visitor review]', author: '[Verified Visitor]' },
                { quote: '[Replace with a real verified visitor review]', author: '[Verified Visitor]' },
                { quote: '[Replace with a real verified visitor review]', author: '[Verified Visitor]' },
              ].map((review, i) => (
                <div key={i} className="bg-card border rounded-xl p-4 text-sm">
                  <p className="text-muted-foreground italic mb-3 leading-relaxed">"{review.quote}"</p>
                  <p className="font-semibold text-xs text-foreground/70">{review.author}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Refund policy — driven by the single REFUND_POLICY constant in src/lib/ticket-schema.ts.
              This text is identical to the Offer.description, MerchantReturnPolicy.description,
              and the FAQ answer — change it in one place and all three update automatically. */}
          <p className="mt-6 text-xs text-muted-foreground">
            <strong>Booking policy:</strong> {config.faq.items.find(i => i.q.toLowerCase().includes('refund'))?.a}
          </p>
        </div>
      </section>

      {/* Getting There Section */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row gap-12">
            <div className="w-full md:w-1/3">
              <h2 className="text-3xl font-serif font-bold mb-6">{t('gettingThere.heading') || "Getting There"}</h2>
              <div className="space-y-6">
                <div>
                  <h4 className="font-bold flex items-center gap-2 mb-2"><MapPin className="w-5 h-5 text-primary" /> {config.location.name}</h4>
                  <p className="text-muted-foreground">{config.location.address}</p>
                </div>
                <div className="space-y-4 pt-6 border-t">
                  {config.location.gettingThereBullets.map((bullet, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="mt-1 text-primary">
                        {bullet.icon === 'bus' && <Bus className="w-5 h-5" />}
                        {bullet.icon !== 'bus' && <Map className="w-5 h-5" />}
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{bullet.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="w-full md:w-2/3 h-[400px] rounded-2xl overflow-hidden shadow-lg border">
              <iframe
                title="Location Map"
                src={config.location.mapEmbedUrl}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Discover Section */}
      <section id="discover" className="py-20 px-6 bg-muted/20">
        <div className="max-w-5xl mx-auto">
          <div className="mb-10">
            <p
              className="text-xs font-bold tracking-widest uppercase mb-3"
              style={{ color: `hsl(${config.brand.colors.primary})` }}
            >
              Discover
            </p>
            <h2 className="text-3xl md:text-4xl font-serif font-bold">Discover</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {registeredArticles.map((article) => (
              <a
                key={article.slug}
                href={article.href}
                data-track={`stories_card_${article.slug}`}
                className="group block bg-card rounded-2xl border p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Category pill + read time */}
                <div className="flex items-center gap-2 text-xs text-foreground/50 mb-2">
                  <span className="border border-foreground/30 rounded-full px-2 py-0.5">
                    {article.category}
                  </span>
                  <span>{article.readTime}</span>
                </div>
                <h3 className="font-serif text-lg font-semibold mb-3 group-hover:underline leading-snug">
                  {article.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-5 line-clamp-3">
                  {article.lede}
                </p>
                <span
                  className="text-sm font-medium"
                  style={{ color: `hsl(${config.brand.colors.primary})` }}
                >
                  Read the guide →
                </span>
              </a>
            ))}
            {/* Placeholder cards from config for un-ported articles */}
            {config.discoverArticles
              .filter((a) => !registeredArticles.some((r) => r.slug === a.slug))
              .map((article) => (
                <a
                  key={article.id}
                  href={`/article/${article.slug}`}
                  data-track={`stories_card_${article.slug}`}
                  className="group block bg-card rounded-2xl border p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <h3 className="font-serif text-lg font-semibold mb-3 group-hover:underline leading-snug">
                    {article.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-5 line-clamp-3">
                    {article.excerpt}
                  </p>
                  <span
                    className="text-sm font-medium"
                    style={{ color: `hsl(${config.brand.colors.primary})` }}
                  >
                    Read the guide →
                  </span>
                </a>
              ))}
          </div>
        </div>
      </section>

      {/* Floating Checkout Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-xl border-t shadow-2xl z-40 transform translate-y-0 transition-transform">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{t('schedule.ticketSummary') || 'Your Tickets'}</span>
            <span className="font-bold text-lg">{totalTickets} {totalTickets === 1 ? t('booking.ticket') : t('booking.tickets')}</span>
          </div>
          <button
            onClick={handleBuy}
            disabled={totalTickets === 0}
            data-track="home_continue_to_schedule"
            className="px-8 py-3 rounded-xl font-bold transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: `hsl(${config.brand.colors.primary})`, color: `hsl(${config.brand.colors.primaryForeground})` }}
          >
            {t('booking.buyTickets')}
          </button>
        </div>
      </div>
      <div className="h-24" /> {/* Spacer for floating bar */}
    </PageLayout>
  );
}
