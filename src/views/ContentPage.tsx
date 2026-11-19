import { PageLayout } from '@/components/layout/PageLayout';
import { getEventConfig } from '@/content';
import { getMessages, translate } from '@/i18n/messages';

export default function ContentPage({ type, locale = 'en' }: { type: 'faq' | 'activities' | 'contact'; locale?: string }) {
  const t = (key: string) => translate(getMessages(locale), key);
  const config = getEventConfig(locale);

  return (
    <PageLayout>
      <div className="max-w-3xl mx-auto px-6 py-20 w-full">
        <h1 className="font-serif text-4xl md:text-5xl font-bold mb-12" style={{ color: `hsl(${config.brand.colors.primary})` }}>
          {type === 'faq' && config.faq.heading}
          {type === 'activities' && config.activities.heading}
          {type === 'contact' && config.contact.heading}
        </h1>

        {type === 'faq' && (
          <div className="space-y-8">
            <p className="text-muted-foreground">{config.faq.mandatoryNote}</p>
            {config.faq.items.map((item, i) => (
              <div key={i} className="p-6 rounded-2xl bg-card border shadow-sm">
                <h2 className="text-lg font-bold mb-3">{item.q}</h2>
                <p className="text-muted-foreground leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        )}

        {type === 'activities' && (
          <div className="space-y-8">
            <p className="text-lg text-muted-foreground mb-8">{config.activities.subtitle}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {config.activities.items.map((item, i) => (
                <div key={i} className="p-6 rounded-2xl bg-card border shadow-sm flex flex-col">
                  <div className="flex justify-between items-start mb-3">
                    <h2 className="text-xl font-bold">{item.title}</h2>
                    {item.status && (
                      <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full bg-muted text-muted-foreground">
                        {item.status}
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground leading-relaxed flex-1">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {type === 'contact' && (
          <div className="space-y-8">
            <div className="space-y-5 text-muted-foreground leading-relaxed">
              {config.contact.description.map((desc, i) => (
                <p key={i} className="text-lg leading-relaxed">{desc}</p>
              ))}
              <a
                href={`mailto:${config.contact.email}`}
                className="block underline hover:opacity-80 text-lg"
                style={{ color: `hsl(${config.brand.colors.primary})` }}
              >
                {config.contact.email}
              </a>
              <div className="pt-2">
                <p className="mb-3">{config.contact.formRecipientNote}</p>
                <div className="flex flex-col gap-2">
                  <a href="/privacy" className="underline hover:opacity-80" style={{ color: `hsl(${config.brand.colors.primary})` }}>Privacy</a>
                  <a href="/cookies" className="underline hover:opacity-80" style={{ color: `hsl(${config.brand.colors.primary})` }}>Cookies</a>
                  <a href="/terms" className="underline hover:opacity-80" style={{ color: `hsl(${config.brand.colors.primary})` }}>Terms</a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
