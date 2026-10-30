'use client';

import {Suspense} from 'react';
import BookingConfirmation, {
  PaymentChecking,
} from '@/app/components/skintwin/BookingConfirmation';
import {useTreatmentCatalog} from '@/app/hooks/useTreatmentCatalog';

function ConfirmationCatalog() {
  const {services, error} = useTreatmentCatalog();
  return (
    <>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <BookingConfirmation services={services} />
    </>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={<PaymentChecking />}>
      <ConfirmationCatalog />
    </Suspense>
  );
}
