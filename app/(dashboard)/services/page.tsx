'use client';

import Link from 'next/link';
import {Button} from '@/components/ui/button';
import ServiceCatalog from '@/app/components/skintwin/ServiceCatalog';
import BookingBasket from '@/app/components/skintwin/BookingBasket';
import {useBooking} from '@/app/contexts/booking/BookingContext';

export default function ServicesPage() {
  const booking = useBooking();

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-accent">
            SkinTwin salon
          </p>
          <h1 className="section-rule text-3xl font-bold">Services</h1>
          <p className="mt-2 max-w-2xl text-subdued">
            Clinic treatment catalog from SkinTwin Salon — facials, consults,
            packages, and add-ons live inside the connect platform.
          </p>
        </div>
        {booking.services.length > 0 && (
          <Link href="/bookings">
            <Button className="btn-cobalt">
              Schedule {booking.services.length} selected
            </Button>
          </Link>
        )}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <ServiceCatalog mode="book" />
        <div className="xl:sticky xl:top-4 xl:self-start">
          <BookingBasket />
        </div>
      </div>
    </>
  );
}
