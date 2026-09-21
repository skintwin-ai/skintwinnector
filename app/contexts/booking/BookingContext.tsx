'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import type {
  Appointment,
  BookingContextValue,
  BookingState,
  CheckoutState,
  Client,
  Service,
  ServiceSelection,
} from './types';

const initialCheckout: CheckoutState = {
  status: 'idle',
};

const initialState: BookingState = {
  services: [],
  appointment: null,
  client: null,
  checkout: initialCheckout,
};

export const BookingContext = createContext<BookingContextValue | undefined>(
  undefined
);

export function BookingProvider({children}: {children: React.ReactNode}) {
  const [services, setServices] = useState<ServiceSelection[]>([]);
  const [appointment, setAppointmentState] = useState<Appointment | null>(null);
  const [client, setClientState] = useState<Client | null>(null);
  const [checkout, setCheckout] = useState<CheckoutState>(initialCheckout);

  const addService = useCallback((serviceId: string, addOns: string[] = []) => {
    setServices((prev) => {
      const existing = prev.find((s) => s.serviceId === serviceId);
      if (existing) {
        return prev.map((s) =>
          s.serviceId === serviceId
            ? {
                ...s,
                quantity: s.quantity + 1,
                addOns: Array.from(new Set([...s.addOns, ...addOns])),
              }
            : s
        );
      }
      return [...prev, {serviceId, quantity: 1, addOns}];
    });
  }, []);

  const removeService = useCallback((serviceId: string) => {
    setServices((prev) => {
      const next = prev.filter((s) => s.serviceId !== serviceId);
      if (next.length === 0) {
        setAppointmentState(null);
      }
      return next;
    });
  }, []);

  const updateServiceQuantity = useCallback(
    (serviceId: string, quantity: number) => {
      if (quantity <= 0) {
        setServices((prev) => {
          const next = prev.filter((s) => s.serviceId !== serviceId);
          if (next.length === 0) {
            setAppointmentState(null);
          }
          return next;
        });
        return;
      }
      setServices((prev) =>
        prev.map((s) => (s.serviceId === serviceId ? {...s, quantity} : s))
      );
    },
    []
  );

  const clearServices = useCallback(() => {
    setServices([]);
    setAppointmentState(null);
  }, []);

  const setAppointment = useCallback((apt: Appointment) => {
    setAppointmentState(apt);
  }, []);

  const clearAppointment = useCallback(() => {
    setAppointmentState(null);
  }, []);

  const setClient = useCallback((c: Client) => {
    setClientState(c);
  }, []);

  const updateClientConsent = useCallback((accepted: boolean) => {
    setClientState((prev) =>
      prev ? {...prev, consentAccepted: accepted} : null
    );
  }, []);

  const updateIntakeStatus = useCallback((completed: boolean) => {
    setClientState((prev) =>
      prev ? {...prev, intakeCompleted: completed} : null
    );
  }, []);

  const clearClient = useCallback(() => {
    setClientState(null);
  }, []);

  const setCheckoutStatus = useCallback((status: CheckoutState['status']) => {
    setCheckout((prev) => {
      if (prev.status === status && prev.error === undefined) {
        return prev;
      }
      return {...prev, status, error: undefined};
    });
  }, []);

  const restoreBookingSnapshot = useCallback(
    (snapshot: {
      services: ServiceSelection[];
      appointment: Appointment | null;
      client: Client | null;
    }) => {
      setServices(snapshot.services);
      setAppointmentState(snapshot.appointment);
      setClientState(snapshot.client);
    },
    []
  );

  const setCheckoutError = useCallback((error: string) => {
    setCheckout((prev) => ({...prev, status: 'failed', error}));
  }, []);

  const clearCheckout = useCallback(() => {
    setCheckout(initialCheckout);
  }, []);

  const resetBooking = useCallback(() => {
    setServices([]);
    setAppointmentState(null);
    setClientState(null);
    setCheckout(initialCheckout);
  }, []);

  const getTotalPrice = useCallback(
    (servicesList: Service[]) => {
      return services.reduce((total, selection) => {
        const service = servicesList.find((s) => s.id === selection.serviceId);
        if (!service) return total;

        let price = service.price * selection.quantity;
        selection.addOns.forEach((addOnId) => {
          const addOn = servicesList.find((s) => s.id === addOnId);
          if (addOn) {
            price += addOn.price;
          }
        });
        return total + price;
      }, 0);
    },
    [services]
  );

  const getTotalDuration = useCallback(
    (servicesList: Service[], includeBuffer = true) => {
      return services.reduce((total, selection) => {
        const service = servicesList.find((s) => s.id === selection.serviceId);
        if (!service) return total;

        const buffer = includeBuffer ? service.bufferMinutes || 0 : 0;
        let duration = (service.durationMinutes + buffer) * selection.quantity;
        selection.addOns.forEach((addOnId) => {
          const addOn = servicesList.find((s) => s.id === addOnId);
          if (addOn) {
            duration += addOn.durationMinutes;
          }
        });
        return total + duration;
      }, 0);
    },
    [services]
  );

  const value = useMemo<BookingContextValue>(
    () => ({
      services,
      appointment,
      client,
      checkout,
      addService,
      removeService,
      updateServiceQuantity,
      clearServices,
      setAppointment,
      clearAppointment,
      setClient,
      updateClientConsent,
      updateIntakeStatus,
      clearClient,
      setCheckoutStatus,
      restoreBookingSnapshot,
      setCheckoutError,
      clearCheckout,
      resetBooking,
      getTotalPrice,
      getTotalDuration,
    }),
    [
      services,
      appointment,
      client,
      checkout,
      addService,
      removeService,
      updateServiceQuantity,
      clearServices,
      setAppointment,
      clearAppointment,
      setClient,
      updateClientConsent,
      updateIntakeStatus,
      clearClient,
      setCheckoutStatus,
      restoreBookingSnapshot,
      setCheckoutError,
      clearCheckout,
      resetBooking,
      getTotalPrice,
      getTotalDuration,
    ]
  );

  return (
    <BookingContext.Provider value={value}>{children}</BookingContext.Provider>
  );
}

export function useBooking(): BookingContextValue {
  const context = useContext(BookingContext);
  if (!context) {
    throw new Error('useBooking must be used within a BookingProvider');
  }
  return context;
}
