'use client';

import ClientIntake from '@/app/components/skintwin/ClientIntake';
import BookingBasket from '@/app/components/skintwin/BookingBasket';

export default function IntakePage() {
  return (
    <>
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-accent">
          SkinTwin salon
        </p>
        <h1 className="section-rule text-3xl font-bold">Client intake</h1>
        <p className="mt-2 max-w-2xl text-subdued">
          Capture or look up client details before confirming the appointment.
        </p>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <ClientIntake />
        <div className="xl:sticky xl:top-4 xl:self-start">
          <BookingBasket
            continueHref="/bookings"
            continueLabel="Review schedule"
          />
        </div>
      </div>
    </>
  );
}
