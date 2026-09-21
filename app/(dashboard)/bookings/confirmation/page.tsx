'use client';

import {Suspense} from 'react';
import BookingConfirmation, {
  PaymentChecking,
} from '@/app/components/skintwin/BookingConfirmation';

export default function ConfirmationPage() {
  return (
    <Suspense fallback={<PaymentChecking />}>
      <BookingConfirmation />
    </Suspense>
  );
}
