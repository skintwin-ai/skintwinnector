import {describe, expect, it} from 'vitest';
import {
  BookingCheckoutValidationError,
  buildCheckoutLineItems,
  type CheckoutCatalogService,
} from './bookingCheckout';

const catalog: CheckoutCatalogService[] = [
  {
    id: 'srv-001',
    name: 'Signature Facial',
    price: 8500,
    usdChargeCents: 8500,
    addOns: ['srv-010', 'srv-011'],
  },
  {
    id: 'srv-002',
    name: 'Deep Cleansing Facial',
    price: 12000,
    usdChargeCents: 12000,
    addOns: ['srv-010'],
  },
  {
    id: 'srv-010',
    name: 'Eye Treatment Add-On',
    price: 3500,
    usdChargeCents: 3500,
    addOns: [],
  },
];

describe('buildCheckoutLineItems', () => {
  it('builds matching line items and totals for two services plus one legal add-on', () => {
    const result = buildCheckoutLineItems(
      [
        {serviceId: 'srv-001', quantity: 1, addOns: ['srv-010']},
        {serviceId: 'srv-002', quantity: 1, addOns: []},
      ],
      catalog,
      'usd'
    );

    expect(result.displayTotal).toBe(24000);
    expect(result.chargeTotal).toBe(24000);
    expect(result.chargeCurrency).toBe('usd');
    expect(result.lineItems).toEqual([
      {
        price_data: {
          currency: 'usd',
          unit_amount: 8500,
          product_data: {name: 'Signature Facial'},
        },
        quantity: 1,
      },
      {
        price_data: {
          currency: 'usd',
          unit_amount: 3500,
          product_data: {name: 'Eye Treatment Add-On'},
        },
        quantity: 1,
      },
      {
        price_data: {
          currency: 'usd',
          unit_amount: 12000,
          product_data: {name: 'Deep Cleansing Facial'},
        },
        quantity: 1,
      },
    ]);
  });

  it('multiplies only the parent service when quantity is 2 and adds each add-on once', () => {
    const result = buildCheckoutLineItems(
      [{serviceId: 'srv-001', quantity: 2, addOns: ['srv-010']}],
      catalog,
      'usd'
    );

    expect(result.displayTotal).toBe(20500);
    expect(result.chargeTotal).toBe(20500);
    expect(result.lineItems[0]).toMatchObject({
      price_data: {unit_amount: 8500},
      quantity: 2,
    });
    expect(result.lineItems[1]).toMatchObject({
      price_data: {unit_amount: 3500},
      quantity: 1,
    });
  });

  it('rejects an unknown service id', () => {
    expect(() =>
      buildCheckoutLineItems(
        [{serviceId: 'srv-missing', quantity: 1, addOns: []}],
        catalog,
        'usd'
      )
    ).toThrow(BookingCheckoutValidationError);
  });

  it('rejects an add-on that is not listed on the parent service', () => {
    expect(() =>
      buildCheckoutLineItems(
        [{serviceId: 'srv-002', quantity: 1, addOns: ['srv-011']}],
        catalog,
        'usd'
      )
    ).toThrow(BookingCheckoutValidationError);
  });

  it('rejects empty selections', () => {
    expect(() => buildCheckoutLineItems([], catalog, 'usd')).toThrow(
      BookingCheckoutValidationError
    );
  });

  it('rejects quantity 11', () => {
    expect(() =>
      buildCheckoutLineItems(
        [{serviceId: 'srv-001', quantity: 11, addOns: []}],
        catalog,
        'usd'
      )
    ).toThrow(BookingCheckoutValidationError);
  });
});
