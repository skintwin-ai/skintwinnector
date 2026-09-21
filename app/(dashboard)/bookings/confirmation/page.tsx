'use client';

import {Suspense} from 'react';
import BookingConfirmation from '@/app/components/skintwin/BookingConfirmation';
import Container from '@/app/components/Container';

function ConfirmationFallback() {
  return (
    <Container
      className="panel-accent-top space-y-3 border-[color:var(--hairline)]"
      aria-live="polite"
    >
      <h2 className="text-xl font-semibold">Checking payment</h2>
      <p className="text-subdued">Retrieving the Stripe Checkout session.</p>
    </Container>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={<ConfirmationFallback />}>
      <BookingConfirmation />
    </Suspense>
  );
}
