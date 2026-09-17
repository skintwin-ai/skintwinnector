'use client';

import {useMemo, useState} from 'react';
import {useRouter} from 'next/navigation';
import {Button} from '@/components/ui/button';
import Container from '@/app/components/Container';
import {useBooking} from '@/app/contexts/booking/BookingContext';
import type {Provider, Service} from '@/app/contexts/booking/types';
import servicesData from '@/app/data/services.json';
import providersData from '@/app/data/providers.json';
import {formatAppointmentDate, formatDuration} from '@/lib/salon';

const services = servicesData as Service[];
const providers = providersData as Provider[];

const BookingScheduler = () => {
  const router = useRouter();
  const booking = useBooking();
  const [selectedDate, setSelectedDate] = useState(
    booking.appointment?.date || ''
  );
  const [selectedTime, setSelectedTime] = useState(
    booking.appointment?.startTime || ''
  );
  const [selectedProvider, setSelectedProvider] = useState(
    booking.appointment?.providerId || ''
  );

  const bookedServices = useMemo(() => {
    return booking.services
      .map((selection) => ({
        ...selection,
        service: services.find((item) => item.id === selection.serviceId),
      }))
      .filter((item) => item.service);
  }, [booking.services]);

  const totalDuration = booking.getTotalDuration(services);

  const availableProviders = useMemo(() => {
    const requiredTypes = new Set<string>();
    bookedServices.forEach((item) => {
      item.service?.providerTypes.forEach((type) => requiredTypes.add(type));
    });
    return providers.filter(
      (provider) => requiredTypes.size === 0 || requiredTypes.has(provider.type)
    );
  }, [bookedServices]);

  const availableDates = useMemo(() => {
    const dates: string[] = [];
    const today = new Date();
    for (let i = 1; i <= 21; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      if (date.getDay() !== 0) {
        dates.push(date.toISOString().split('T')[0]);
      }
    }
    return dates;
  }, []);

  const timeSlots = useMemo(() => {
    const slots: {time: string; available: boolean}[] = [];
    for (let hour = 8; hour < 18; hour++) {
      for (const minute of [0, 30]) {
        const time = `${hour.toString().padStart(2, '0')}:${minute
          .toString()
          .padStart(2, '0')}`;
        const seed = `${selectedDate}-${selectedProvider}-${time}`;
        const available =
          selectedDate && selectedProvider
            ? seed
                .split('')
                .reduce((sum, char) => sum + char.charCodeAt(0), 0) %
                5 !==
              0
            : true;
        slots.push({time, available});
      }
    }
    return slots;
  }, [selectedDate, selectedProvider]);

  const handleContinue = () => {
    if (!selectedDate || !selectedTime || !selectedProvider) {
      return;
    }

    const [hours, mins] = selectedTime.split(':').map(Number);
    const endMinutes = hours * 60 + mins + totalDuration;
    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;
    const endTime = `${endHours.toString().padStart(2, '0')}:${endMins
      .toString()
      .padStart(2, '0')}`;

    booking.setAppointment({
      date: selectedDate,
      startTime: selectedTime,
      endTime,
      providerId: selectedProvider,
      totalDurationMinutes: totalDuration,
    });

    router.push('/bookings/intake');
  };

  if (booking.services.length === 0) {
    return (
      <Container className="panel-accent-top space-y-3 border-[color:var(--hairline)]">
        <h2 className="text-xl font-semibold">No services selected</h2>
        <p className="text-subdued">
          Choose treatments from the SkinTwin catalog before scheduling.
        </p>
        <Button onClick={() => router.push('/services')}>
          Browse services
        </Button>
      </Container>
    );
  }

  return (
    <div className="space-y-4">
      <Container className="panel-accent-top space-y-3 border-[color:var(--hairline)]">
        <h2 className="text-lg font-semibold">Select date</h2>
        <div
          className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7"
          data-testid="booking-calendar"
        >
          {availableDates.map((date) => (
            <button
              key={date}
              type="button"
              data-date={date}
              className={`rounded-md border px-2 py-2 text-sm transition ${
                selectedDate === date
                  ? 'border-accent bg-accent-subdued text-accent'
                  : 'border-[color:var(--hairline)] bg-offset text-primary hover:border-accent'
              }`}
              onClick={() => setSelectedDate(date)}
            >
              {formatAppointmentDate(date)}
            </button>
          ))}
        </div>
        {selectedDate && (
          <p className="text-sm text-subdued" data-testid="selected-date">
            Selected: {formatAppointmentDate(selectedDate)}
          </p>
        )}
      </Container>

      <Container className="panel-accent-top space-y-3 border-[color:var(--hairline)]">
        <h2 className="text-lg font-semibold">Select provider</h2>
        <div
          className="grid gap-2 md:grid-cols-2"
          data-testid="provider-selector"
        >
          {availableProviders.map((provider) => (
            <button
              key={provider.id}
              type="button"
              data-provider={provider.id}
              className={`rounded-md border p-3 text-left transition ${
                selectedProvider === provider.id
                  ? 'border-accent bg-accent-subdued'
                  : 'border-[color:var(--hairline)] bg-offset hover:border-accent'
              }`}
              onClick={() => setSelectedProvider(provider.id)}
            >
              <p className="font-semibold">{provider.name}</p>
              <p className="text-sm text-subdued">{provider.title}</p>
              <p className="mt-1 text-xs text-subdued">{provider.bio}</p>
            </button>
          ))}
        </div>
        {selectedProvider && (
          <p className="text-sm text-subdued" data-testid="selected-provider">
            Selected:{' '}
            {
              providers.find((provider) => provider.id === selectedProvider)
                ?.name
            }
          </p>
        )}
      </Container>

      <Container className="panel-accent-top space-y-3 border-[color:var(--hairline)]">
        <h2 className="text-lg font-semibold">Select time</h2>
        <div
          className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6"
          data-testid="time-slots"
        >
          {timeSlots.map((slot) => (
            <button
              key={slot.time}
              type="button"
              data-time={slot.time}
              data-available={slot.available}
              disabled={!slot.available}
              className={`rounded-md border px-2 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
                selectedTime === slot.time
                  ? 'border-accent bg-accent-subdued text-accent'
                  : 'border-[color:var(--hairline)] bg-offset text-primary hover:border-accent'
              }`}
              onClick={() => slot.available && setSelectedTime(slot.time)}
            >
              {slot.time}
            </button>
          ))}
        </div>
        {selectedTime && (
          <p className="text-sm text-subdued" data-testid="selected-time">
            Selected: {selectedTime} · {formatDuration(totalDuration)}
          </p>
        )}
      </Container>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() => router.push('/services')}
          data-testid="back-to-services"
        >
          Back to services
        </Button>
        <Button
          className="btn-cobalt"
          onClick={handleContinue}
          disabled={!selectedDate || !selectedTime || !selectedProvider}
          data-testid="continue-to-intake"
        >
          Continue to client info
        </Button>
      </div>
    </div>
  );
};

export default BookingScheduler;
