'use client';

import BookingScheduler from '@/app/components/skintwin/BookingScheduler';
import BookingBasket from '@/app/components/skintwin/BookingBasket';
import {useBooking} from '@/app/contexts/booking/BookingContext';
import {useTreatmentCatalog} from '@/app/hooks/useTreatmentCatalog';

export default function BookingsPage() {
  const booking = useBooking();
  const {services, error} = useTreatmentCatalog();

  return (
    <>
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-accent">
          SkinTwin salon
        </p>
        <h1 className="section-rule text-3xl font-bold">Bookings</h1>
        <p className="mt-2 max-w-2xl text-subdued">
          Schedule a provider, date, and time for the services in the basket,
          then capture client intake.
        </p>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <BookingScheduler services={services} />
        <div className="xl:sticky xl:top-4 xl:self-start">
          <BookingBasket
            services={services}
            continueHref="/bookings/intake"
            continueLabel="Continue to client info"
            continueDisabled={!booking.appointment}
          />
        </div>
      </div>
    </>
  );
}
