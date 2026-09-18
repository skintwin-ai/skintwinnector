'use client';

import {useEffect, useState} from 'react';
import Link from 'next/link';
import {Button} from '@/components/ui/button';
import Container from '@/app/components/Container';
import {useBooking} from '@/app/contexts/booking/BookingContext';
import type {Provider, Service} from '@/app/contexts/booking/types';
import servicesData from '@/app/data/services.json';
import providersData from '@/app/data/providers.json';
import {formatCurrency, formatDuration} from '@/lib/salon';

const services = servicesData as Service[];
const providers = providersData as Provider[];

const BookingConfirmation = () => {
  const booking = useBooking();
  const bookedServices = booking.services
    .map((selection) => ({
      ...selection,
      service: services.find((item) => item.id === selection.serviceId),
    }))
    .filter((item) => item.service);
  const provider = providers.find(
    (item) => item.id === booking.appointment?.providerId
  );
  const [fallbackConfirmationNumber] = useState(
    () => `APT-${Date.now().toString().slice(-8)}`
  );
  const confirmationNumber =
    booking.checkout.invoiceId || fallbackConfirmationNumber;

  useEffect(() => {
    if (
      booking.appointment &&
      booking.client &&
      bookedServices.length > 0 &&
      !booking.checkout.invoiceId
    ) {
      booking.setInvoiceDetails(confirmationNumber, '');
    }
  }, [
    bookedServices.length,
    booking.appointment,
    booking.client,
    booking.checkout.invoiceId,
    booking.setInvoiceDetails,
    confirmationNumber,
  ]);

  if (!booking.appointment || !booking.client || bookedServices.length === 0) {
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

  return (
    <div className="space-y-4" data-testid="booking-confirmation">
      <Container className="panel-accent-top space-y-2 border-[color:var(--hairline)]">
        <p className="text-xs uppercase tracking-[0.16em] text-accent">
          Confirmed
        </p>
        <h1 className="text-3xl font-bold">Booking confirmed</h1>
        <p className="text-subdued">
          {booking.client.firstName}&apos;s appointment is on the clinic
          schedule. A confirmation can be printed for the front desk.
        </p>
      </Container>

      <div className="grid gap-4 lg:grid-cols-2">
        <Container className="space-y-3 border-[color:var(--hairline)]">
          <h2 className="text-lg font-semibold">Appointment</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-subdued">Confirmation</dt>
              <dd data-testid="confirmation-number">{confirmationNumber}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-subdued">Date</dt>
              <dd data-testid="confirmation-date">
                {booking.appointment.date}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-subdued">Time</dt>
              <dd data-testid="confirmation-time">
                {booking.appointment.startTime} – {booking.appointment.endTime}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-subdued">Provider</dt>
              <dd data-testid="confirmation-provider">
                {provider?.name || booking.appointment.providerId}
              </dd>
            </div>
          </dl>
        </Container>

        <Container className="space-y-3 border-[color:var(--hairline)]">
          <h2 className="text-lg font-semibold">Client</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-subdued">Name</dt>
              <dd data-testid="confirmation-client-name">
                {booking.client.firstName} {booking.client.lastName}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-subdued">Email</dt>
              <dd data-testid="confirmation-email">{booking.client.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-subdued">Phone</dt>
              <dd data-testid="confirmation-phone">{booking.client.phone}</dd>
            </div>
          </dl>
        </Container>
      </div>

      <Container className="space-y-3 border-[color:var(--hairline)]">
        <h2 className="text-lg font-semibold">Services</h2>
        <ul className="space-y-2" data-testid="confirmation-services">
          {bookedServices.map((item) => (
            <li
              key={item.serviceId}
              className="flex items-center justify-between text-sm"
            >
              <span>
                {item.service?.name}
                {item.quantity > 1 ? ` ×${item.quantity}` : ''}
              </span>
              <span className="text-subdued">
                {formatDuration(
                  (item.service?.durationMinutes || 0) * item.quantity
                )}{' '}
                ·{' '}
                {formatCurrency(
                  (item.service?.price || 0) * item.quantity,
                  item.service?.currency
                )}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t border-[color:var(--hairline)] pt-3 text-sm font-medium">
          <span data-testid="confirmation-duration">
            {formatDuration(booking.getTotalDuration(services, false))}
          </span>
          <span data-testid="confirmation-total">
            {formatCurrency(booking.getTotalPrice(services))}
          </span>
        </div>
      </Container>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => window.print()}>
          Print receipt
        </Button>
        <Link href="/services" onClick={() => booking.resetBooking()}>
          <Button className="btn-cobalt" data-testid="new-booking-button">
            Book another appointment
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default BookingConfirmation;
