import type {ServiceSelection} from '@/app/contexts/booking/types';

export class BookingCheckoutValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BookingCheckoutValidationError';
  }
}

export type CheckoutCatalogService = {
  id: string;
  name: string;
  price: number;
  usdChargeCents: number;
  addOns: string[];
};

export type CheckoutLineItem = {
  price_data: {
    currency: string;
    unit_amount: number;
    product_data: {name: string};
  };
  quantity: number;
};

const FORBIDDEN_CLIENT_PRICE_KEYS = new Set([
  'unit_amount',
  'amount',
  'currency',
  'price_data',
]);

export function bodyContainsClientPricing(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some(bodyContainsClientPricing);
  }
  const record = value as Record<string, unknown>;
  return Object.keys(record).some(
    (key) =>
      FORBIDDEN_CLIENT_PRICE_KEYS.has(key) ||
      bodyContainsClientPricing(record[key])
  );
}

export function isCheckoutSessionId(
  value: string | null | undefined
): value is string {
  return typeof value === 'string' && value.startsWith('cs_');
}

export function bookingIdempotencyKey(
  draftId: string,
  retryAttempt?: number
): string {
  if (retryAttempt && retryAttempt >= 2) {
    return `booking-checkout:${draftId}:${retryAttempt}`;
  }
  return `booking-checkout:${draftId}`;
}

export function encodeSelectionMetadata(
  selections: ServiceSelection[]
): string {
  return selections
    .map((selection) => {
      const addOns = selection.addOns.length
        ? `+${selection.addOns.join('+')}`
        : '';
      return `${selection.serviceId}:${selection.quantity}${addOns}`;
    })
    .join(';');
}

export function decodeSelectionMetadata(encoded: string): ServiceSelection[] {
  if (!encoded) {
    return [];
  }
  return encoded
    .split(';')
    .filter(Boolean)
    .map((part) => {
      const [head, ...addOns] = part.split('+');
      const [serviceId, quantity] = head.split(':');
      return {
        serviceId,
        quantity: Number(quantity) || 1,
        addOns,
      };
    });
}

export function buildCheckoutLineItems(
  selections: ServiceSelection[],
  catalog: CheckoutCatalogService[],
  chargeCurrency: string
): {
  lineItems: CheckoutLineItem[];
  displayTotal: number;
  chargeTotal: number;
  chargeCurrency: string;
} {
  if (!selections.length) {
    throw new BookingCheckoutValidationError('Select at least one service');
  }

  const catalogById = new Map(catalog.map((service) => [service.id, service]));
  const lineItems: CheckoutLineItem[] = [];
  let displayTotal = 0;
  let chargeTotal = 0;

  for (const selection of selections) {
    if (selection.quantity < 1 || selection.quantity > 10) {
      throw new BookingCheckoutValidationError(
        'Quantity must be between 1 and 10'
      );
    }

    const service = catalogById.get(selection.serviceId);
    if (!service) {
      throw new BookingCheckoutValidationError(
        `Unknown service: ${selection.serviceId}`
      );
    }

    lineItems.push({
      price_data: {
        currency: chargeCurrency,
        unit_amount: service.usdChargeCents,
        product_data: {name: service.name},
      },
      quantity: selection.quantity,
    });
    displayTotal += service.price * selection.quantity;
    chargeTotal += service.usdChargeCents * selection.quantity;

    for (const addOnId of selection.addOns) {
      if (!service.addOns.includes(addOnId)) {
        throw new BookingCheckoutValidationError(
          `Add-on ${addOnId} is not allowed for ${service.id}`
        );
      }
      const addOn = catalogById.get(addOnId);
      if (!addOn) {
        throw new BookingCheckoutValidationError(`Unknown add-on: ${addOnId}`);
      }
      lineItems.push({
        price_data: {
          currency: chargeCurrency,
          unit_amount: addOn.usdChargeCents,
          product_data: {name: addOn.name},
        },
        quantity: 1,
      });
      displayTotal += addOn.price;
      chargeTotal += addOn.usdChargeCents;
    }
  }

  return {lineItems, displayTotal, chargeTotal, chargeCurrency};
}
