'use client';

import Link from 'next/link';
import {Minus, Plus, Trash2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import Container from '@/app/components/Container';
import {useBooking} from '@/app/contexts/booking/BookingContext';
import type {Service} from '@/app/contexts/booking/types';
import servicesData from '@/app/data/services.json';
import {formatCurrency, formatDuration} from '@/lib/salon';

const services = servicesData as Service[];

const BookingBasket = ({
  continueHref = '/bookings',
  continueLabel = 'Schedule appointment',
  continueDisabled = false,
}: {
  continueHref?: string;
  continueLabel?: string;
  continueDisabled?: boolean;
}) => {
  const booking = useBooking();
  const selected = booking.services
    .map((selection) => ({
      ...selection,
      service: services.find((item) => item.id === selection.serviceId),
    }))
    .filter((item) => item.service);

  const totalPrice = booking.getTotalPrice(services);
  const totalDuration = booking.getTotalDuration(services, false);

  if (selected.length === 0) {
    return (
      <Container className="panel-accent-top space-y-3 border-[color:var(--hairline)]">
        <h2 className="text-lg font-semibold">Booking basket</h2>
        <p className="text-sm text-subdued">
          Add treatments from the catalog to start a booking.
        </p>
        <Link href="/services">
          <Button size="sm" variant="outline">
            Browse services
          </Button>
        </Link>
      </Container>
    );
  }

  return (
    <Container className="panel-accent-top space-y-4 border-[color:var(--hairline)]">
      <div>
        <h2 className="text-lg font-semibold">Booking basket</h2>
        <p className="text-sm text-subdued">
          {selected.length} service{selected.length === 1 ? '' : 's'} selected
        </p>
      </div>
      <ul className="space-y-3" data-testid="booking-summary">
        {selected.map((item) => (
          <li
            key={item.serviceId}
            className="flex items-start justify-between gap-3 border-b border-[color:var(--hairline)] pb-3 last:border-0"
            data-service={item.serviceId}
          >
            <div>
              <p className="font-medium">{item.service?.name}</p>
              <p className="text-sm text-subdued">
                {formatDuration(
                  (item.service?.durationMinutes || 0) * item.quantity
                )}{' '}
                ·{' '}
                {formatCurrency(
                  (item.service?.price || 0) * item.quantity,
                  item.service?.currency
                )}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Decrease ${item.service?.name}`}
                onClick={() =>
                  booking.updateServiceQuantity(
                    item.serviceId,
                    item.quantity - 1
                  )
                }
              >
                <Minus size={14} />
              </Button>
              <span className="w-5 text-center text-sm">{item.quantity}</span>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Increase ${item.service?.name}`}
                onClick={() =>
                  booking.updateServiceQuantity(
                    item.serviceId,
                    item.quantity + 1
                  )
                }
              >
                <Plus size={14} />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Remove ${item.service?.name}`}
                onClick={() => booking.removeService(item.serviceId)}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between text-sm font-medium">
        <span data-testid="total-duration">
          {formatDuration(totalDuration)}
        </span>
        <span>{formatCurrency(totalPrice)}</span>
      </div>
      {continueDisabled ? (
        <Button className="btn-cobalt w-full" disabled>
          {continueLabel}
        </Button>
      ) : (
        <Link href={continueHref}>
          <Button className="btn-cobalt w-full">{continueLabel}</Button>
        </Link>
      )}
    </Container>
  );
};

export default BookingBasket;
