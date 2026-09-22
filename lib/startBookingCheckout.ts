import type {
  Appointment,
  Client,
  ServiceSelection,
} from '@/app/contexts/booking/types';
import {deleteBookingDraft, persistBookingDraft} from '@/lib/bookingDraft';

export type StartBookingCheckoutInput = {
  draftId: string;
  retryAttempt?: number;
  services: ServiceSelection[];
  appointment: Appointment;
  client: Client;
  replaceSessionId?: string;
};

export async function startBookingCheckout(input: StartBookingCheckoutInput) {
  const response = await fetch('/api/bookings/create_checkout_session', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      draftId: input.draftId,
      retryAttempt: input.retryAttempt,
      replaceSessionId: input.replaceSessionId,
      services: input.services,
      appointment: input.appointment,
      client: input.client,
    }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.checkoutUrl || !payload.sessionId) {
    throw new Error(payload.error || 'Unable to start checkout');
  }

  const retryAttempt =
    input.retryAttempt && input.retryAttempt >= 2 ? input.retryAttempt : 1;
  persistBookingDraft(payload.sessionId, {
    draftId: input.draftId,
    sessionId: payload.sessionId,
    retryAttempt,
    services: input.services,
    appointment: input.appointment,
    client: input.client,
  });
  if (input.replaceSessionId && input.replaceSessionId !== payload.sessionId) {
    deleteBookingDraft(input.replaceSessionId);
  }

  return {
    checkoutUrl: payload.checkoutUrl as string,
    sessionId: payload.sessionId as string,
  };
}
