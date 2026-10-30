import {
  applicationFeeAmount,
  isSupportedChargeCurrency,
  unitAmountForCurrency,
  type ChargeCurrency,
} from '@/lib/bookingCheckout';
import type {Service} from '@/app/contexts/booking/types';

const FORBIDDEN_KEYS = new Set([
  'unit_amount',
  'amount',
  'currency',
  'price_data',
  'operatorAccountId',
  'appointment',
  'draftId',
]);

export function bodyContainsForbiddenCheckoutFields(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some(bodyContainsForbiddenCheckoutFields);
  }
  return Object.entries(value as Record<string, unknown>).some(
    ([key, nested]) =>
      FORBIDDEN_KEYS.has(key) || bodyContainsForbiddenCheckoutFields(nested)
  );
}

export function sellerCanCharge(account: {
  id?: string;
  default_currency?: string | null;
  charges_enabled?: boolean;
  capabilities?: {card_payments?: string};
}) {
  const capabilities = account.capabilities;
  const live =
    typeof account.charges_enabled === 'boolean' ||
    (capabilities != null &&
      Object.prototype.hasOwnProperty.call(capabilities, 'card_payments'));
  if (!live) {
    return Boolean(account.id && account.default_currency);
  }
  return (
    account.charges_enabled === true && capabilities?.card_payments === 'active'
  );
}

export type PricedMarketplaceLine = {
  serviceId: string;
  name: string;
  quantity: number;
  unitAmount: number;
};

export function priceMarketplaceSelections(
  selections: unknown,
  catalog: Array<Service & {published?: boolean}>,
  currency: ChargeCurrency
):
  | {ok: true; lines: PricedMarketplaceLine[]; merchandiseTotal: number}
  | {ok: false; error: string} {
  if (!Array.isArray(selections) || selections.length === 0) {
    return {ok: false, error: 'Select at least one service'};
  }
  if (selections.length > 100) {
    return {ok: false, error: 'A checkout can include at most 100 lines'};
  }
  const byId = new Map(
    catalog
      .filter((service) => service.published)
      .map((service) => [service.id, service])
  );
  const lines: PricedMarketplaceLine[] = [];
  for (const selection of selections) {
    if (!selection || typeof selection !== 'object') {
      return {ok: false, error: 'Invalid service selection'};
    }
    const value = selection as {serviceId?: unknown; quantity?: unknown};
    const serviceId =
      typeof value.serviceId === 'string' ? value.serviceId : '';
    const service = byId.get(serviceId);
    if (!service) {
      return {ok: false, error: `Unknown service: ${serviceId || 'missing'}`};
    }
    if (
      !Number.isInteger(value.quantity) ||
      (value.quantity as number) < 1 ||
      (value.quantity as number) > 100
    ) {
      return {
        ok: false,
        error: 'Quantity must be a positive integer up to 100',
      };
    }
    const quantity = value.quantity as number;
    const unitAmount = unitAmountForCurrency(service, currency);
    lines.push({
      serviceId,
      name: service.name,
      quantity,
      unitAmount,
    });
  }
  const merchandiseTotal = lines.reduce(
    (sum, line) => sum + line.unitAmount * line.quantity,
    0
  );
  return {ok: true, lines, merchandiseTotal};
}

export function marketplaceIdempotencyKey(
  buyerAccountId: string,
  sellerAccountId: string,
  lines: PricedMarketplaceLine[]
) {
  const canonical = [...lines]
    .map((line) => `${line.serviceId}:${line.quantity}:${line.unitAmount}`)
    .sort()
    .join('|');
  return `marketplace-checkout:${buyerAccountId}:${sellerAccountId}:${canonical}`;
}

export function marketplaceFee(merchandiseTotal: number) {
  return applicationFeeAmount(merchandiseTotal);
}

export function assertSupportedSellerCurrency(
  currency: string | null | undefined
) {
  if (!isSupportedChargeCurrency(currency)) {
    return `Unsupported charge currency: ${currency}`;
  }
  return null;
}
