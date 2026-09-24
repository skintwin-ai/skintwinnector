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

export const SUPPORTED_CHARGE_CURRENCIES = ['usd', 'ngn'] as const;
export type ChargeCurrency = (typeof SUPPORTED_CHARGE_CURRENCIES)[number];

export const DEFAULT_APPLICATION_FEE_BPS = 1000;

export function isSupportedChargeCurrency(
  value: string | null | undefined
): value is ChargeCurrency {
  return (
    typeof value === 'string' &&
    SUPPORTED_CHARGE_CURRENCIES.includes(value as ChargeCurrency)
  );
}

export function unitAmountForCurrency(
  item: CheckoutCatalogService,
  chargeCurrency: ChargeCurrency
): number {
  if (chargeCurrency === 'usd') {
    return item.usdChargeCents;
  }
  // Catalog `price` is NGN major units. Stripe NGN is kobo.
  return item.price * 100;
}

export function applicationFeeAmount(
  chargeTotal: number,
  feeBps = Number(process.env.SKINTWIN_APPLICATION_FEE_BPS) ||
    DEFAULT_APPLICATION_FEE_BPS
): number {
  if (!Number.isFinite(feeBps) || feeBps <= 0 || chargeTotal <= 0) {
    return 0;
  }
  return Math.min(chargeTotal - 1, Math.round((chargeTotal * feeBps) / 10000));
}

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
  chargeCurrency: string | undefined
): {
  lineItems: CheckoutLineItem[];
  displayTotal: number;
  chargeTotal: number;
  chargeCurrency: ChargeCurrency;
  applicationFeeAmount: number;
} {
  if (!isSupportedChargeCurrency(chargeCurrency)) {
    throw new BookingCheckoutValidationError(
      `Unsupported charge currency: ${chargeCurrency}`
    );
  }
  if (!selections.length) {
    throw new BookingCheckoutValidationError('Select at least one service');
  }

  const catalogById = new Map(catalog.map((service) => [service.id, service]));
  const lineItems: CheckoutLineItem[] = [];
  let displayTotal = 0;
  let chargeTotal = 0;

  const addLine = (item: CheckoutCatalogService, quantity: number) => {
    const unitAmount = unitAmountForCurrency(item, chargeCurrency);
    lineItems.push({
      price_data: {
        currency: chargeCurrency,
        unit_amount: unitAmount,
        product_data: {name: item.name},
      },
      quantity,
    });
    displayTotal += item.price * quantity;
    chargeTotal += unitAmount * quantity;
  };

  for (const selection of selections) {
    if (
      typeof selection?.serviceId !== 'string' ||
      !selection.serviceId ||
      !Number.isInteger(selection.quantity) ||
      !Array.isArray(selection.addOns) ||
      selection.addOns.some((addOnId) => typeof addOnId !== 'string')
    ) {
      throw new BookingCheckoutValidationError('Invalid service selection');
    }
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

    addLine(service, selection.quantity);

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
      addLine(addOn, 1);
    }
  }

  return {
    lineItems,
    displayTotal,
    chargeTotal,
    chargeCurrency,
    applicationFeeAmount: applicationFeeAmount(chargeTotal),
  };
}
