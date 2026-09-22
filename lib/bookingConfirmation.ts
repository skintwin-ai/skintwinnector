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
  | 'retrieve-error'
  | 'paid'
  | 'unpaid';

export function isPaidPaymentStatus(status: string | null | undefined) {
  return status === 'paid';
}

export function resolveConfirmationPhase(input: {
  resolved: boolean;
  sessionId: string | null;
  retrieved: RetrievedCheckout | null;
  retrieveFailed?: boolean;
}): ConfirmationPhase {
  if (!input.resolved) {
    return 'pending';
  }
  if (!input.sessionId) {
    return 'empty';
  }
  if (input.retrieved) {
    return isPaidPaymentStatus(input.retrieved.paymentStatus)
      ? 'paid'
      : 'unpaid';
  }
  if (input.retrieveFailed) {
    return 'retrieve-error';
  }
  return 'not-found';
}

export function attachCatalogServices(
  selections: ServiceSelection[],
  catalog: Service[]
): Array<ServiceSelection & {service?: Service}> {
  return selections.map((selection) => ({
    ...selection,
    service: serviceById(catalog, selection.serviceId),
  }));
}

export function servicesFromMetadata(
  metadata: Record<string, string> | undefined,
  catalog: Service[]
): Array<ServiceSelection & {service?: Service}> {
  return attachCatalogServices(
    decodeSelectionMetadata(metadata?.selections || ''),
    catalog
  );
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
