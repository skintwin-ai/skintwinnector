'use client';

import {useEffect, useMemo, useState} from 'react';
import Container from '@/app/components/Container';
import {Badge} from '@/components/ui/badge';
import {ChevronDown} from 'lucide-react';
import type {ClinicBookingRecord} from '@/lib/clinicRecords';
import servicesData from '@/app/data/services.json';
import providersData from '@/app/data/providers.json';
import {toLocalDateKey} from '@/lib/salon';

const SCHEDULE_HEIGHT = 1440;
const MINUTES_IN_BUSINESS_DAY = 600;
const services = servicesData as {id: string; name: string; category: string}[];
const providers = providersData as {id: string; name: string}[];

const getCurrentDate = () => {
  const currentDate = new Date();
  const options = {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  } as Intl.DateTimeFormatOptions;
  return currentDate.toLocaleDateString('en-US', options);
};

function minutesSince9(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours - 9) * 60 + minutes;
}

function getMinutesSince9AM() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes() - 9 * 60;
}

const renderDayProgressBar = () => {
  const minutesSince9AM = getMinutesSince9AM();

  if (minutesSince9AM < 0 || minutesSince9AM > MINUTES_IN_BUSINESS_DAY) {
    return null;
  }

  return (
    <div
      className="absolute left-[40px] z-30 h-[2px] w-[calc(100%-35px)] bg-accent"
      style={{
        top: `${(SCHEDULE_HEIGHT * minutesSince9AM) / MINUTES_IN_BUSINESS_DAY + 60}px`,
      }}
    >
      <div className="relative left-0 top-[-3px] h-2 w-2 rounded-full border-2 border-accent bg-accent"></div>
    </div>
  );
};

const renderHourBlock = (hour: string) => {
  return (
    <div className="flex h-36 flex-row">
      <div className="w-12 text-sm text-subdued">
        <div className="-translate-y-[50%]">{hour}</div>
      </div>
      <div className="grid flex-1 grid-cols-1 divide-y border-t-2">
        <div></div>
        <div></div>
      </div>
    </div>
  );
};

const Schedule = () => {
  const today = toLocalDateKey(new Date());
  const [bookings, setBookings] = useState<ClinicBookingRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/bookings?date=${today}`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || 'Unable to load schedule');
        }
        if (!cancelled) {
          setBookings(payload.bookings || []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBookings([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [today]);

  const columns = useMemo(() => {
    const byProvider = new Map<string, ClinicBookingRecord[]>();
    for (const booking of bookings) {
      const providerId = booking.appointment?.providerId || 'unassigned';
      const current = byProvider.get(providerId) || [];
      current.push(booking);
      byProvider.set(providerId, current);
    }
    const ids = Array.from(byProvider.keys());
    if (!ids.length) {
      return providers.slice(0, 2).map((provider) => ({
        id: provider.id,
        provider: provider.name,
        sessions: [] as ClinicBookingRecord[],
      }));
    }
    return ids.map((id) => ({
      id,
      provider: providers.find((provider) => provider.id === id)?.name || id,
      sessions: byProvider.get(id) || [],
    }));
  }, [bookings]);

  return (
    <div>
      <div className="relative space-y-4">
        <div className="flex justify-between gap-2 sm:items-center">
          <h1 className="text-xl font-bold">Today&apos;s schedule</h1>
          <div className="font-bold text-accent">{getCurrentDate()}</div>
        </div>
        {loading && (
          <p className="text-sm text-subdued" data-testid="schedule-loading">
            Loading booked treatments…
          </p>
        )}
        {!loading && bookings.length === 0 && (
          <p className="text-sm text-subdued" data-testid="schedule-empty">
            No treatments booked for today. Paid or synced appointments appear
            here.
          </p>
        )}
        <div className="relative left-0 z-30 flex w-full flex-row">
          {renderDayProgressBar()}
        </div>
        <div className="ml-10 flex flex-row">
          {columns.map(({id, provider}) => (
            <h2
              key={id}
              className="ml-8 flex flex-1 flex-row items-center space-x-1 text-lg font-bold last:hidden md:last:flex"
            >
              <div>{provider}</div>
              <ChevronDown color="#6c7688" />
            </h2>
          ))}
        </div>
        <div className="relative flex bg-screen-foreground">
          <div className="absolute z-10 w-full flex-1">
            {renderHourBlock('9 AM')}
            {renderHourBlock('10 AM')}
            {renderHourBlock('11 AM')}
            {renderHourBlock('12 PM')}
            {renderHourBlock('1 PM')}
            {renderHourBlock('2 PM')}
            {renderHourBlock('3 PM')}
            {renderHourBlock('4 PM')}
            {renderHourBlock('5 PM')}
            {renderHourBlock('6 PM')}
          </div>
          <div
            className={`relative top-0 z-20 flex h-[1440px] w-full flex-row gap-4 pl-16`}
          >
            {columns.map(({id, sessions}) => (
              <div
                key={id}
                className="relative flex flex-grow flex-col last:hidden md:last:flex"
              >
                {sessions.map((booking) => {
                  const start = booking.appointment?.startTime || '09:00';
                  const end = booking.appointment?.endTime || '10:00';
                  const startTimeMinutes = minutesSince9(start);
                  const endTimeMinutes = minutesSince9(end);
                  const serviceName =
                    services.find(
                      (service) => service.id === booking.services[0]?.serviceId
                    )?.name || 'Treatment';
                  const clientName = booking.client
                    ? `${booking.client.firstName} ${booking.client.lastName}`.trim()
                    : 'Client';
                  return (
                    <div
                      key={booking.id}
                      data-testid="schedule-booking"
                      className="hover:z-100 absolute flex w-full cursor-pointer flex-col justify-between space-y-2 rounded-md border bg-offset bg-screen-background p-3 text-primary transition duration-150 hover:scale-[1.01] hover:bg-screen-foreground hover:shadow-md"
                      style={{
                        height: `${Math.max(
                          80,
                          Math.round(
                            (SCHEDULE_HEIGHT *
                              (endTimeMinutes - startTimeMinutes)) /
                              MINUTES_IN_BUSINESS_DAY
                          )
                        )}px`,
                        top: `${Math.max(
                          0,
                          Math.round(
                            (SCHEDULE_HEIGHT * startTimeMinutes) /
                              MINUTES_IN_BUSINESS_DAY
                          )
                        )}px`,
                      }}
                    >
                      <div>
                        <div className="text-md font-medium text-accent">
                          {start} - {end}
                        </div>
                        <div className="text-md truncate font-medium">
                          {serviceName}
                        </div>
                      </div>
                      <div className="text-md flex items-end gap-2">
                        <div className="relative flex flex-1 items-center gap-2 font-medium">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 text-xs">
                            {clientName.slice(0, 1)}
                          </div>
                          {clientName}
                        </div>
                        <Badge variant="blue">
                          {booking.paymentStatus === 'paid' ? 'paid' : 'hold'}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Schedule;
