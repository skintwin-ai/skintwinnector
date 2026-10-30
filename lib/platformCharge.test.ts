import {describe, expect, it} from 'vitest';
import type {CheckoutCatalogService} from './bookingCheckout';
import {platformCharge} from './platformCharge';

const catalog: CheckoutCatalogService[] = [
  {
    id: 'srv-001',
    name: 'Signature Facial',
    price: 8500,
    usdChargeCents: 8500,
    addOns: ['srv-010'],
  },
  {
    id: 'srv-002',
    name: 'Deep Cleansing Facial',
    price: 12000,
    usdChargeCents: 12000,
    addOns: [],
  },
];

const facial = [{serviceId: 'srv-001', quantity: 1, addOns: []}];

describe('platformCharge', () => {
  it('returns catalog usd cents when there is no payload amount', () => {
    expect(
      platformCharge({
        selections: facial,
        currency: 'usd',
        catalog,
      })
    ).toEqual({amountMinor: 8500, currency: 'usd'});
  });

  it('returns catalog ngn kobo when currency is ngn', () => {
    expect(
      platformCharge({
        selections: facial,
        currency: 'ngn',
        catalog,
      })
    ).toEqual({amountMinor: 850000, currency: 'ngn'});
  });

  it('defaults omitted salon currency to ngn', () => {
    expect(
      platformCharge({
        selections: facial,
        source: 'skintwin-salon',
        catalog,
      })
    ).toEqual({amountMinor: 850000, currency: 'ngn'});
  });

  it('scales a salon ngn payload amount to kobo', () => {
    expect(
      platformCharge({
        amountTotal: 8500,
        selections: facial,
        currency: 'NGN',
        catalog,
      })
    ).toEqual({amountMinor: 850000, currency: 'ngn'});
  });

  it('uses a usd payload amount instead of the catalog', () => {
    expect(
      platformCharge({
        amountTotal: 1,
        selections: facial,
        currency: 'usd',
        catalog,
      })
    ).toEqual({amountMinor: 1, currency: 'usd'});
  });

  it('returns no charge when a known id is mixed with an unknown id', () => {
    expect(
      platformCharge({
        selections: [
          {serviceId: 'srv-missing', quantity: 1, addOns: []},
          {serviceId: 'srv-001', quantity: 1, addOns: []},
        ],
        currency: 'usd',
        catalog,
      })
    ).toBeNull();
  });

  it('returns no charge for unknown-only, empty, zero quantity, or zar', () => {
    expect(
      platformCharge({
        selections: [{serviceId: 'srv-missing', quantity: 1, addOns: []}],
        currency: 'usd',
        catalog,
      })
    ).toBeNull();
    expect(
      platformCharge({
        selections: [],
        currency: 'usd',
        catalog,
      })
    ).toBeNull();
    expect(
      platformCharge({
        selections: [{serviceId: 'srv-001', quantity: 0, addOns: []}],
        currency: 'usd',
        catalog,
      })
    ).toBeNull();
    expect(
      platformCharge({
        selections: facial,
        currency: 'zar',
        catalog,
      })
    ).toBeNull();
  });

  it('multiplies catalog quantity', () => {
    expect(
      platformCharge({
        selections: [{serviceId: 'srv-001', quantity: 2, addOns: []}],
        currency: 'usd',
        catalog,
      })
    ).toEqual({amountMinor: 17000, currency: 'usd'});
  });
});
