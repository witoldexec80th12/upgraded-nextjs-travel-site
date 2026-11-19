'use client';

import { Link } from '@/lib/navigation';
import { useSearchParams } from 'next/navigation';
import { useI18n } from '@/i18n/I18nContext';
import { getEventConfig } from '@/content';
import { PageLayout } from '@/components/layout/PageLayout';
import { CheckCircle2, ArrowRight } from 'lucide-react';

export default function Success() {
  const { locale } = useI18n();
  const config = getEventConfig(locale);
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order_id') || 'DEMO-12345';

  return (
    <PageLayout>
      <div className="flex-1 flex flex-col items-center justify-center py-20 px-6 max-w-2xl mx-auto text-center">
        
        <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mb-8">
          <CheckCircle2 className="w-12 h-12 text-green-600" />
        </div>

        <h1 className="font-serif text-4xl md:text-5xl font-bold mb-4" style={{ color: `hsl(${config.brand.colors.primary})` }}>
          Booking Confirmed
        </h1>

        <p className="text-lg text-muted-foreground mb-12">
          Your tickets for {config.brand.name} have been booked successfully. A confirmation email has been sent to your address.
        </p>

        <div className="w-full bg-card border rounded-3xl p-8 shadow-sm mb-12 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-2 bg-green-500" />
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Order Reference</p>
          <p className="text-3xl font-mono font-bold tracking-widest" style={{ color: `hsl(${config.brand.colors.accent})` }}>
            {orderId}
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            Please keep this reference for your records and present it upon arrival.
          </p>
        </div>

        <div className="bg-blue-50 text-blue-800 rounded-2xl p-6 text-sm mb-12 text-left w-full border border-blue-100">
          <h4 className="font-bold uppercase tracking-widest text-xs mb-3 text-blue-900">Important Reminders</h4>
          <ul className="space-y-2">
            <li className="flex gap-2"><span>•</span> Arrive at least 15 minutes before your scheduled entry time.</li>
            <li className="flex gap-2"><span>•</span> Present your digital or printed ticket at the main entrance.</li>
            <li className="flex gap-2"><span>•</span> This is a demo template. No real transaction has occurred.</li>
          </ul>
        </div>

        <Link 
          href="/"
          className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold transition-all shadow-sm hover:shadow-md"
          style={{ backgroundColor: `hsl(${config.brand.colors.primary})`, color: `hsl(${config.brand.colors.primaryForeground})` }}
        >
          Return to Home <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </PageLayout>
  );
}
