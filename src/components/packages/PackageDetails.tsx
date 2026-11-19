import type { Package } from '@/lib/packages';
import { PageLayout } from '@/components/layout/PageLayout';
import { PackageBookingLink } from './PackageBookingLink';

export function PackageDetails({ item }: { item: Package }) {
  return <PageLayout>
    <article lang={item.contentLocale} className="max-w-5xl mx-auto px-6 py-12 w-full">
      <h1 className="font-serif text-4xl font-bold mb-6">{item.title}</h1>
      <p className="text-lg mb-8">{item.description}</p>
      <img src={item.image} alt={item.title} className="w-full rounded-3xl mb-8" />
      <div className="grid md:grid-cols-2 gap-6">
        {item.tickets.map((ticket) => <section key={ticket.id} className="border rounded-3xl p-6">
          <h2 className="font-serif text-2xl font-bold mb-3">{ticket.title}</h2>
          <p className="mb-3">{ticket.details}</p><p className="mb-3">{ticket.hours}</p>
          <p className="font-semibold mb-5">€{ticket.adultPrice.toFixed(2)}</p>
          <PackageBookingLink slug={item.slug} ticketId={ticket.id} />
        </section>)}
      </div>
    </article>
  </PageLayout>;
}
