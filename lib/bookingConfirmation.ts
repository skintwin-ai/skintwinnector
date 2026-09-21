import type {Service, ServiceSelection} from '@/app/contexts/booking/types';
import {decodeSelectionMetadata} from '@/lib/bookingCheckout';
import {serviceById} from '@/lib/salon';

export type RetrievedCheckout = {
  sessionId: string;
  paymentStatus: string;
  amountTotal: number | null;
  currency: string | null;
  paymentIntentId: string | null;
  metadata: Record<string, string>;
};

export type ConfirmationPhase =
  | 'pending'
  | 'empty'
  | 'not-found'
  | 'paid'
  | 'unpaid';

export function isPaidPaymentStatus(status: string | null | undefined) {
  return status === 'paid';
}

export function resolveConfirmationPhase(input: {
  resolved: boolean;
  sessionId: string | null;
  retrieveOk: boolean | null;
  paymentStatus: string | null;
  hasDraft: boolean;
}): ConfirmationPhase {
  if (!input.resolved) {
    return 'pending';
  }
  if (input.sessionId && input.retrieveOk === false) {
    return 'not-found';
  }
  if (input.retrieveOk && isPaidPaymentStatus(input.paymentStatus)) {
    return 'paid';
  }
  if (input.retrieveOk) {
    return 'unpaid';
  }
  if (!input.sessionId && !input.hasDraft) {
    return 'empty';
  }
  return 'empty';
}

export function servicesFromMetadata(
  metadata: Record<string, string> | undefined,
  catalog: Service[]
): Array<ServiceSelection & {service?: Service}> {
  const selections = decodeSelectionMetadata(metadata?.selections || '');
  return selections.map((selection) => ({
    ...selection,
    service: serviceById(catalog, selection.serviceId),
  }));
}

export function formatStripeMoney(
  amountTotal: number | null,
  currency: string | null
) {
  if (amountTotal == null || !currency) {
    return '—';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amountTotal / 100);
}

export function paymentReference(retrieved: RetrievedCheckout) {
  return retrieved.paymentIntentId || retrieved.sessionId;
}
