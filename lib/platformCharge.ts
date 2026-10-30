import type {ServiceSelection} from '@/app/contexts/booking/types';
import {
  type ChargeCurrency,
  type CheckoutCatalogService,
  isSupportedChargeCurrency,
  unitAmountForCurrency,
} from '@/lib/bookingCheckout';

export type PlatformCharge = {
  amountMinor: number;
  currency: ChargeCurrency;
};

function resolveChargeCurrency(
  currency: unknown,
  source?: string
): ChargeCurrency | null {
  if (typeof currency === 'string' && currency.trim()) {
    const normalized = currency.trim().toLowerCase();
    return isSupportedChargeCurrency(normalized) ? normalized : null;
  }
  if (source === 'skintwin-salon') {
    return 'ngn';
  }
  return null;
}

function payloadAmountMinor(amountTotal: unknown): number | null {
  return typeof amountTotal === 'number' &&
    Number.isInteger(amountTotal) &&
    amountTotal > 0
    ? amountTotal
    : null;
}

function catalogAmountMinor(
  selections: ServiceSelection[],
  currency: ChargeCurrency,
  catalog: CheckoutCatalogService[]
): number | null {
  const catalogById = new Map(catalog.map((item) => [item.id, item]));
  let total = 0;
  let priced = false;

  for (const selection of selections) {
    if (typeof selection?.serviceId !== 'string' || !selection.serviceId) {
      continue;
    }
    const item = catalogById.get(selection.serviceId);
    if (!item) {
      return null;
    }
    const quantity = Number.isInteger(selection.quantity)
      ? selection.quantity
      : 0;
    if (quantity < 1) {
      continue;
    }
    total += unitAmountForCurrency(item, currency) * quantity;
    priced = true;
  }

  return priced && Number.isInteger(total) && total > 0 ? total : null;
}

export function platformCharge(input: {
  amountTotal?: unknown;
  selections: ServiceSelection[];
  currency?: unknown;
  source?: string;
  catalog: CheckoutCatalogService[];
}): PlatformCharge | null {
  const currency = resolveChargeCurrency(input.currency, input.source);
  if (!currency) {
    return null;
  }

  const payloadAmount = payloadAmountMinor(input.amountTotal);
  if (payloadAmount != null) {
    const amountMinor =
      currency === 'ngn' ? payloadAmount * 100 : payloadAmount;
    return amountMinor > 0 ? {amountMinor, currency} : null;
  }

  const catalogAmount = catalogAmountMinor(
    input.selections,
    currency,
    input.catalog
  );
  return catalogAmount != null
    ? {amountMinor: catalogAmount, currency}
    : null;
}
