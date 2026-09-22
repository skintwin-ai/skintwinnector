import type {
  Appointment,
  Client,
  ServiceSelection,
} from '@/app/contexts/booking/types';
import type {CheckoutCatalogService} from '@/lib/bookingCheckout';

export type WizardCheckoutInput = {
  draftId: string;
  catalog: CheckoutCatalogService[];
  services: ServiceSelection[];
  appointment: Appointment;
  client: Client;
};

export function buildWizardCheckoutBody(input: WizardCheckoutInput) {
  if (!input.draftId.trim()) {
    throw new Error('draftId is required');
  }
  if (!input.services.length) {
    throw new Error('Select at least one service');
  }
  for (const selection of input.services) {
    if (!input.catalog.some((item) => item.id === selection.serviceId)) {
      throw new Error(`Unknown service ${selection.serviceId}`);
    }
  }
  if (!input.appointment?.date || !input.appointment.startTime) {
    throw new Error('Appointment date and time are required');
  }
  if (!input.client?.email || !input.client.consentAccepted) {
    throw new Error('Client email and consent are required');
  }
  return {
    draftId: input.draftId,
    services: input.services,
    appointment: input.appointment,
    client: input.client,
  };
}
