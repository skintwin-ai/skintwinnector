'use client';

import {useEffect, useState} from 'react';
import Link from 'next/link';
import {useRouter, useSearchParams} from 'next/navigation';
import {Button} from '@/components/ui/button';
import Container from '@/app/components/Container';
import {useBooking} from '@/app/contexts/booking/BookingContext';
import type {Provider, Service} from '@/app/contexts/booking/types';
import servicesData from '@/app/data/services.json';
import providersData from '@/app/data/providers.json';
import {
  attachCatalogServices,
  formatStripeMoney,
  isPaidPaymentStatus,
  paymentReference,
  resolveConfirmationPhase,
  servicesFromMetadata,
  type RetrievedCheckout,
} from '@/lib/bookingConfirmation';
import {
  deleteBookingDraft,
  loadBookingDraft,
  type BookingDraft,
} from '@/lib/bookingDraft';
import {startBookingCheckout} from '@/lib/startBookingCheckout';
import {formatCurrency, formatDuration} from '@/lib/salon';

const services = servicesData as Service[];
const providers = providersData as Provider[];

export function PaymentChecking() {
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

const BookingConfirmation = () => {
  const booking = useBooking();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [resolved, setResolved] = useState(false);
  const [retrieved, setRetrieved] = useState<RetrievedCheckout | null>(null);
  const [retrieveFailed, setRetrieveFailed] = useState(false);
  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const isCreatingCheckout = booking.checkout.status === 'creating';

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      if (!sessionId) {
        setResolved(true);
        return;
      }

      try {
        const response = await fetch(
          `/api/bookings/checkout_session?session_id=${encodeURIComponent(sessionId)}`,
          {signal: controller.signal}
        );
        if (response.status === 401 || response.status === 404) {
          deleteBookingDraft(sessionId);
          setResolved(true);
          return;
        }
        if (!response.ok) {
          setDraft(loadBookingDraft(sessionId));
          setRetrieveFailed(true);
          setResolved(true);
          return;
        }

        const payload = (await response.json()) as RetrievedCheckout;
        const stored = loadBookingDraft(sessionId);
        if (stored) {
          booking.restoreBookingSnapshot({
            services: stored.services,
            appointment: stored.appointment,
            client: stored.client,
          });
          setDraft(stored);
        }
        if (isPaidPaymentStatus(payload.paymentStatus)) {
          booking.setCheckoutStatus('paid');
        }
        setRetrieved(payload);
        setResolved(true);
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          return;
        }
        setDraft(loadBookingDraft(sessionId));
        setRetrieveFailed(true);
        setResolved(true);
      }
    }

    void load();
    return () => {
      controller.abort();
    };
    // Hydrate once per session id; booking methods are stable enough for this load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const phase = resolveConfirmationPhase({
    resolved,
    sessionId,
    retrieved,
    retrieveFailed,
  });

  const appointment = draft?.appointment || null;
  const client = draft?.client || null;
  const visibleServices = draft
    ? attachCatalogServices(draft.services, services)
    : retrieved
      ? servicesFromMetadata(retrieved.metadata, services)
      : [];
  const provider = providers.find(
    (item) => item.id === appointment?.providerId
  );

  const handleRetry = async () => {
    if (!draft || isCreatingCheckout) {
      return;
    }
    booking.setCheckoutStatus('creating');
    try {
      const checkout = await startBookingCheckout({
        draftId: draft.draftId,
        retryAttempt: (draft.retryAttempt || 1) + 1,
        services: draft.services,
        appointment: draft.appointment,
        client: draft.client,
        replaceSessionId: draft.sessionId,
      });
      booking.setCheckoutStatus('pending');
      window.location.assign(checkout.checkoutUrl);
    } catch (error: any) {
      booking.setCheckoutError(error.message || 'Unable to retry payment');
    }
  };

  const handleEdit = () => {
    if (draft) {
      booking.restoreBookingSnapshot({
        services: draft.services,
        appointment: draft.appointment,
        client: draft.client,
      });
    }
    router.push('/bookings/intake');
  };

  if (phase === 'pending') {
    return <PaymentChecking />;
  }

  if (phase === 'retrieve-error') {
    return (
      <Container
        className="panel-accent-top space-y-3 border-[color:var(--hairline)]"
        data-testid="retrieve-error"
      >
        <h2 className="text-xl font-semibold">Unable to retrieve payment</h2>
        <p className="text-subdued">
          We could not load the Stripe Checkout session. Try checking again.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            className="btn-cobalt"
            onClick={() => window.location.reload()}
            data-testid="retry-retrieve"
          >
            Check payment again
          </Button>
          {draft && (
            <>
              <Button
                variant="secondary"
                onClick={handleRetry}
                disabled={isCreatingCheckout}
                data-testid="retry-payment"
              >
                Retry payment
              </Button>
              <Button
                variant="secondary"
                onClick={handleEdit}
                data-testid="edit-booking"
              >
                Edit booking
              </Button>
            </>
          )}
        </div>
      </Container>
    );
  }

  if (phase === 'empty' || phase === 'not-found') {
    return (
      <Container className="panel-accent-top space-y-3 border-[color:var(--hairline)]">
        <h2 className="text-xl font-semibold">No booking to confirm</h2>
        <p className="text-subdued">
          Start with the SkinTwin service catalog to create an appointment.
        </p>
        <Link href="/services">
          <Button>Browse services</Button>
        </Link>
      </Container>
    );
  }

  const paid = phase === 'paid';
  const reference = retrieved ? paymentReference(retrieved) : '';

  return (
    <div className="space-y-4" data-testid="booking-confirmation">
      <Container className="panel-accent-top space-y-2 border-[color:var(--hairline)]">
        <p
          className="text-xs uppercase tracking-[0.16em] text-accent"
          data-testid={paid ? 'payment-received' : 'payment-incomplete'}
        >
          {paid ? 'Paid' : 'Payment incomplete'}
        </p>
        <h1 className="text-3xl font-bold">
          {paid ? 'Payment received' : 'Payment not completed'}
        </h1>
        <p className="text-subdued">
          {paid
            ? 'This is a payment receipt. It does not mean the appointment is stored on a clinic schedule.'
            : 'Stripe did not collect payment for this checkout. You can retry or edit the booking.'}
        </p>
        {!draft && (
          <p className="text-sm text-subdued">
            The local booking draft was lost. Appointment time and client email
            are unavailable.
          </p>
        )}
      </Container>

      <div className="grid gap-4 lg:grid-cols-2">
        <Container className="space-y-3 border-[color:var(--hairline)]">
          <h2 className="text-lg font-semibold">Appointment</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-subdued">Reference</dt>
              <dd data-testid="confirmation-number">{reference}</dd>
            </div>
            {appointment && (
              <>
                <div className="flex justify-between gap-4">
                  <dt className="text-subdued">Date</dt>
                  <dd data-testid="confirmation-date">{appointment.date}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-subdued">Time</dt>
                  <dd data-testid="confirmation-time">
                    {appointment.startTime} – {appointment.endTime}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-subdued">Provider</dt>
                  <dd data-testid="confirmation-provider">
                    {provider?.name || appointment.providerId}
                  </dd>
                </div>
              </>
            )}
          </dl>
        </Container>

        <Container className="space-y-3 border-[color:var(--hairline)]">
          <h2 className="text-lg font-semibold">Payment</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-subdued">Charged</dt>
              <dd data-testid="confirmation-charged">
                {formatStripeMoney(
                  retrieved?.amountTotal ?? null,
                  retrieved?.currency ?? null
                )}
              </dd>
            </div>
            {client && (
              <>
                <div className="flex justify-between gap-4">
                  <dt className="text-subdued">Name</dt>
                  <dd data-testid="confirmation-client-name">
                    {client.firstName} {client.lastName}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-subdued">Email</dt>
                  <dd data-testid="confirmation-email">{client.email}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-subdued">Phone</dt>
                  <dd data-testid="confirmation-phone">{client.phone}</dd>
                </div>
              </>
            )}
          </dl>
        </Container>
      </div>

      <Container className="space-y-3 border-[color:var(--hairline)]">
        <h2 className="text-lg font-semibold">Services</h2>
        <ul className="space-y-2" data-testid="confirmation-services">
          {visibleServices.map((item) => (
            <li
              key={`${item.serviceId}-${item.addOns.join('-')}`}
              className="flex items-center justify-between text-sm"
            >
              <span>
                {item.service?.name || item.serviceId}
                {item.quantity > 1 ? ` ×${item.quantity}` : ''}
              </span>
              {item.service && (
                <span className="text-subdued">
                  {formatDuration(item.service.durationMinutes * item.quantity)}{' '}
                  ·{' '}
                  {formatCurrency(
                    item.service.price * item.quantity,
                    item.service.currency
                  )}
                </span>
              )}
            </li>
          ))}
        </ul>
        {draft && (
          <div className="flex justify-between border-t border-[color:var(--hairline)] pt-3 text-sm font-medium">
            <span data-testid="confirmation-duration">
              {formatDuration(booking.getTotalDuration(services, false))}
            </span>
            <span data-testid="confirmation-total">
              {formatCurrency(booking.getTotalPrice(services))}
            </span>
          </div>
        )}
        <p className="text-xs text-subdued">
          Catalog total is display-only. Stripe{' '}
          {retrieved?.currency?.toUpperCase()} is the amount due.
        </p>
      </Container>

      <div className="flex flex-wrap gap-2">
        {paid && (
          <Button variant="secondary" onClick={() => window.print()}>
            Print receipt
          </Button>
        )}
        {!paid && (
          <>
            {booking.checkout.status === 'failed' && booking.checkout.error && (
              <p
                className="w-full text-sm text-red-400"
                role="alert"
                aria-live="assertive"
                data-testid="error-checkout"
              >
                {booking.checkout.error}
              </p>
            )}
            <Button
              className="btn-cobalt"
              onClick={handleRetry}
              disabled={isCreatingCheckout || !draft}
              data-testid="retry-payment"
            >
              {isCreatingCheckout ? 'Redirecting to payment' : 'Retry payment'}
            </Button>
            <Button
              variant="secondary"
              onClick={handleEdit}
              data-testid="edit-booking"
            >
              Edit booking
            </Button>
          </>
        )}
        {paid && (
          <Link href="/services" onClick={() => booking.resetBooking()}>
            <Button className="btn-cobalt" data-testid="new-booking-button">
              Book another appointment
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
};

export default BookingConfirmation;
