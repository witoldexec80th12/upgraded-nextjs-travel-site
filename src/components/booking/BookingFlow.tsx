'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocation } from '@/lib/navigation';
import { useI18n } from '@/i18n/I18nContext';
import { getEventConfig } from '@/content';
import { PageLayout } from '@/components/layout/PageLayout';
import { DayPicker } from 'react-day-picker';
import { format, addDays, isBefore, startOfToday } from 'date-fns';
import { ChevronLeft, ChevronRight, Clock, CalendarDays, Loader2 } from 'lucide-react';
import { trackEvent } from '@/lib/analytics/client';
import 'react-day-picker/dist/style.css';
import type { Package } from '@/lib/packages';

// Mock availability hash
function getMockAvailability(dateStr: string, hour: number) {
  const hash = dateStr.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + hour;
  return hash % 5 !== 0; // 80% chance of being available
}

export default function BookingFlow({ item }: { item: Package }) {
  const { locale, t } = useI18n();
  const config = getEventConfig(locale);
  const [location, setLocation] = useLocation();

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Parse query params to get order summary
  const searchParams = useSearchParams();
  let totalItems = 0;
  let totalPrice = 0;
  const summary: { name: string; qty: number; price: number }[] = [];

  item.tickets.forEach(tk => {
    const adultQty = parseInt(searchParams.get(`${tk.id}_adults`) || '0', 10);
    const childQty = parseInt(searchParams.get(`${tk.id}_children`) || '0', 10);
    if (adultQty > 0) {
      summary.push({ name: `${tk.title} - ${t('booking.adult')}`, qty: adultQty, price: adultQty * tk.adultPrice });
      totalItems += adultQty;
      totalPrice += adultQty * tk.adultPrice;
    }
    if (childQty > 0) {
      summary.push({ name: `${tk.title} - ${t('booking.child')}`, qty: childQty, price: childQty * tk.childPrice });
      totalItems += childQty;
      totalPrice += childQty * tk.childPrice;
    }
  });

  // Redirect if no tickets
  useEffect(() => {
    if (totalItems === 0) {
      setLocation('/');
    }
  }, [totalItems, setLocation]);

  const today = startOfToday();
  const maxDate = addDays(today, 90);

  const hours = [9, 10, 11, 12, 13, 14, 15, 16, 17];
  
  const availableSlots = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return hours.flatMap(hour => {
      const isAvailable = getMockAvailability(dateStr, hour);
      return [
        { time: `${hour}:00`, available: isAvailable },
        { time: `${hour}:30`, available: isAvailable }
      ];
    });
  }, [selectedDate]);

  const handleCheckout = () => {
    if (!selectedDate || !selectedTime) return;
    trackEvent('checkout_start', {
      visit_date: format(selectedDate, 'yyyy-MM-dd'),
      visit_time: selectedTime,
      ticket_count: totalItems,
    });
    setIsCheckingOut(true);
    // Mock network delay
    setTimeout(() => {
      const orderId = `ORD-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      setLocation(`/success?order_id=${orderId}`);
    }, 1500);
  };

  if (totalItems === 0) return null;

  return (
    <PageLayout>
      <div className="max-w-5xl mx-auto px-6 py-12 w-full flex flex-col lg:flex-row gap-12 items-start">
        
        {/* Left Col: Calendar & Times */}
        <div className="flex-1 w-full space-y-10">
          <div>
            <h1 className="font-serif text-3xl md:text-4xl font-bold mb-2">{t('schedule.title') || 'Choose Date & Time'}</h1>
            <p className="text-muted-foreground">{t('schedule.selectDateFirst') || 'Select a date to see available time slots.'}</p>
          </div>

          <div className="bg-card border rounded-3xl p-6 shadow-sm flex justify-center">
            <DayPicker
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                setSelectedDate(date);
                setSelectedTime('');
                if (date) {
                  trackEvent('date_pick', { visit_date: format(date, 'yyyy-MM-dd') });
                }
              }}
              disabled={{ before: today, after: maxDate }}
              showOutsideDays
              className="font-sans"
              classNames={{
                months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                month: "space-y-4",
                caption: "flex justify-center pt-1 relative items-center",
                caption_label: "text-lg font-bold font-serif",
                nav: "space-x-1 flex items-center",
                nav_button: "h-9 w-9 bg-transparent p-0 opacity-50 hover:opacity-100 flex items-center justify-center rounded-full hover:bg-muted transition-colors",
                nav_button_previous: "absolute left-1",
                nav_button_next: "absolute right-1",
                table: "w-full border-collapse space-y-1",
                head_row: "flex w-full",
                head_cell: "text-muted-foreground rounded-md w-10 font-medium text-[0.8rem] uppercase tracking-wider",
                row: "flex w-full mt-2",
                cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                day: "h-10 w-10 p-0 font-normal hover:bg-muted rounded-full transition-colors",
                day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground font-bold shadow-md",
                day_today: "bg-accent text-accent-foreground font-bold",
                day_outside: "text-muted-foreground opacity-50",
                day_disabled: "text-muted-foreground opacity-30 cursor-not-allowed hover:bg-transparent",
                day_hidden: "invisible",
              }}
              components={{
                Chevron: ({ orientation }) =>
                  orientation === "left" ? (
                    <ChevronLeft className="h-5 w-5" />
                  ) : (
                    <ChevronRight className="h-5 w-5" />
                  ),
              }}
            />
          </div>

          {selectedDate && (
            <div className="bg-card border rounded-3xl p-6 shadow-sm animate-in fade-in slide-in-from-bottom-4">
              <h3 className="font-bold flex items-center gap-2 mb-6">
                <Clock className="w-5 h-5 text-primary" />
                {format(selectedDate, 'EEEE, MMMM do, yyyy')}
              </h3>
              
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {availableSlots.map((slot, i) => (
                  <button
                    key={i}
                    disabled={!slot.available}
                    onClick={() => setSelectedTime(slot.time)}
                    className={`
                      py-3 px-2 rounded-xl text-sm font-semibold transition-all border
                      ${!slot.available ? 'opacity-30 bg-muted cursor-not-allowed' : 
                        selectedTime === slot.time ? 'bg-primary text-primary-foreground shadow-md border-primary' : 
                        'hover:border-primary hover:bg-primary/5 bg-background'}
                    `}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Col: Summary */}
        <div className="w-full lg:w-[380px] shrink-0 sticky top-28">
          <div className="bg-card border rounded-3xl p-6 shadow-xl overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: `hsl(${config.brand.colors.accent})` }} />
            
            <h3 className="font-bold uppercase tracking-widest text-xs text-muted-foreground mb-6">
              {t('schedule.ticketSummary') || 'Your Order'}
            </h3>
            
            <div className="space-y-4 mb-8">
              {summary.map((item, i) => (
                <div key={i} className="flex justify-between items-start text-sm">
                  <span className="text-muted-foreground">
                    <strong className="text-foreground">{item.qty}x</strong> {item.name}
                  </span>
                  <span className="font-medium">€{item.price.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="pt-6 border-t flex justify-between items-center mb-8">
              <span className="font-bold text-lg">{t('schedule.total') || 'Total'}</span>
              <span className="font-bold text-2xl" style={{ color: `hsl(${config.brand.colors.primary})` }}>€{totalPrice.toFixed(2)}</span>
            </div>

            {(selectedDate && selectedTime) ? (
              <div className="mb-6 p-4 rounded-xl bg-muted/50 flex flex-col gap-1 text-sm font-medium">
                <span className="flex items-center gap-2"><CalendarDays className="w-4 h-4 text-primary" /> {format(selectedDate, 'MMM d, yyyy')}</span>
                <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> {selectedTime}</span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center mb-6 italic">
                {t('schedule.selectSlotError') || 'Select a date and time to continue'}
              </p>
            )}

            <button
              onClick={handleCheckout}
              disabled={!selectedDate || !selectedTime || isCheckingOut}
              data-track="schedule_continue_to_checkout"
              className="w-full py-4 rounded-xl font-bold text-lg transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ backgroundColor: `hsl(${config.brand.colors.primary})`, color: `hsl(${config.brand.colors.primaryForeground})` }}
            >
              {isCheckingOut ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
              ) : (
                t('schedule.continue') || 'Continue to Checkout'
              )}
            </button>
            
            <p className="text-xs text-center text-muted-foreground mt-4">
              Secure checkout. This is a demo template — no real payment will be taken.
            </p>
          </div>
        </div>

      </div>
    </PageLayout>
  );
}
