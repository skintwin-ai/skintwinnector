import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NextRequest} from 'next/server';
import {
  createLocalStripe,
  resetLocalStripeForTests,
} from '@/lib/localStripeRail';
import {resetClinicRecordsForTests} from '@/lib/clinicRecords';
import {
  findMarketplaceOrderBySession,
  resetMarketplaceOrdersForTests,
  saveMarketplaceOrder,
} from '@/lib/marketplaceOrders';
import {POST} from './route';

const getServerSession = vi.fn();
const markBookingPayment = vi.fn();
const dbConnect = vi.hoisted(() =>
  vi.fn().mockRejectedValue(new Error('no mongo in unit tests'))
);
const findOneAndUpdate = vi.hoisted(() => vi.fn());

vi.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => getServerSession(...args),
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

vi.mock('@/lib/dbConnect', () => ({
  default: dbConnect,
}));

vi.mock('@/app/models/marketplaceOrder', () => ({
  default: {
    findOneAndUpdate: (...args: unknown[]) => findOneAndUpdate(...args),
    findOne: () => ({lean: async () => null}),
  },
}));

vi.mock('@/lib/clinicRecords', async () => {
  const actual = await vi.importActual<typeof import('@/lib/clinicRecords')>(
    '@/lib/clinicRecords'
  );
  return {
    ...actual,
    markBookingPayment: (...args: unknown[]) => {
      markBookingPayment(...args);
      return actual.markBookingPayment(
        ...(args as Parameters<typeof actual.markBookingPayment>)
      );
    },
  };
});

describe('POST /api/payments/local/confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SKINTWIN_LOCAL_STRIPE_STORE = `/tmp/skintwin-local-stripe-confirm-${process.pid}.json`;
    resetLocalStripeForTests();
    resetClinicRecordsForTests();
    resetMarketplaceOrdersForTests();
    dbConnect.mockRejectedValue(new Error('no mongo in unit tests'));
    findOneAndUpdate.mockResolvedValue({id: 'ord_1'});
    getServerSession.mockResolvedValue({
      user: {stripeAccountId: 'acct_buyer'},
    });
    process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
    process.env.NEXTAUTH_URL = 'http://localhost:3000';
  });

  it('settles a local checkout session', async () => {
    const stripe = createLocalStripe();
    const created = await stripe.checkout.sessions.create(
      {
        metadata: {draftId: 'draft-1', operatorAccountId: 'acct_local_demo'},
        line_items: [
          {quantity: 1, price_data: {unit_amount: 8500, currency: 'usd'}},
        ],
      },
      {stripeAccount: 'acct_local_demo'}
    );

    const response = await POST(
      new NextRequest('http://localhost/api/payments/local/confirm', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({sessionId: created.id}),
      })
    );
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.paymentStatus).toBe('paid');
    expect(payload.confirmationUrl).toContain('/bookings/confirmation');
    expect(payload.confirmationUrl).toContain(created.id);
  });

  it('settles a marketplace order for the buying salon only', async () => {
    const stripe = createLocalStripe();
    const created = await stripe.checkout.sessions.create(
      {
        metadata: {orderKind: 'marketplace'},
        line_items: [
          {quantity: 1, price_data: {unit_amount: 8500, currency: 'usd'}},
        ],
      },
      {stripeAccount: 'acct_seller'}
    );
    await saveMarketplaceOrder({
      id: 'ord_local',
      sellerAccountId: 'acct_seller',
      buyerAccountId: 'acct_buyer',
      checkoutSessionId: created.id,
      checkoutUrl: created.url,
      currency: 'usd',
      merchandiseTotal: 8500,
      amountTotal: null,
      paymentStatus: 'unpaid',
      lines: [
        {serviceId: 'srv-live', name: 'Retail', quantity: 1, unitAmount: 8500},
      ],
      mismatch: null,
      idempotencyKey:
        'marketplace-checkout:acct_buyer:acct_seller:srv-live:1:8500',
    });

    const response = await POST(
      new NextRequest('http://localhost/api/payments/local/confirm', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({sessionId: created.id}),
      })
    );
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.confirmationUrl).toContain('/market/orders/ord_local');
    expect(payload.confirmationUrl).not.toContain('/bookings/confirmation');
    expect(markBookingPayment).not.toHaveBeenCalled();
    const stored = await findMarketplaceOrderBySession(
      'acct_seller',
      created.id
    );
    expect(stored?.paymentStatus).toBe('paid');
  });

  it('returns 403 for a different salon and does not mark the order paid', async () => {
    const stripe = createLocalStripe();
    const created = await stripe.checkout.sessions.create(
      {
        metadata: {orderKind: 'marketplace'},
        line_items: [
          {quantity: 1, price_data: {unit_amount: 8500, currency: 'usd'}},
        ],
      },
      {stripeAccount: 'acct_seller'}
    );
    await saveMarketplaceOrder({
      id: 'ord_forbidden',
      sellerAccountId: 'acct_seller',
      buyerAccountId: 'acct_buyer',
      checkoutSessionId: created.id,
      checkoutUrl: created.url,
      currency: 'usd',
      merchandiseTotal: 8500,
      amountTotal: null,
      paymentStatus: 'unpaid',
      lines: [
        {serviceId: 'srv-live', name: 'Retail', quantity: 1, unitAmount: 8500},
      ],
      mismatch: null,
      idempotencyKey: 'marketplace-checkout:forbidden',
    });
    getServerSession.mockResolvedValue({
      user: {stripeAccountId: 'acct_other'},
    });
    const response = await POST(
      new NextRequest('http://localhost/api/payments/local/confirm', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({sessionId: created.id}),
      })
    );
    expect(response.status).toBe(403);
    const stored = await findMarketplaceOrderBySession(
      'acct_seller',
      created.id
    );
    expect(stored?.paymentStatus).toBe('unpaid');
  });

  it('returns non-2xx and no URL when the marketplace write fails', async () => {
    const stripe = createLocalStripe();
    const created = await stripe.checkout.sessions.create(
      {
        metadata: {orderKind: 'marketplace'},
        line_items: [
          {quantity: 1, price_data: {unit_amount: 8500, currency: 'usd'}},
        ],
      },
      {stripeAccount: 'acct_seller'}
    );
    await saveMarketplaceOrder({
      id: 'ord_fail',
      sellerAccountId: 'acct_seller',
      buyerAccountId: 'acct_buyer',
      checkoutSessionId: created.id,
      checkoutUrl: created.url,
      currency: 'usd',
      merchandiseTotal: 8500,
      amountTotal: null,
      paymentStatus: 'unpaid',
      lines: [
        {serviceId: 'srv-live', name: 'Retail', quantity: 1, unitAmount: 8500},
      ],
      mismatch: null,
      idempotencyKey: 'marketplace-checkout:fail',
    });
    dbConnect.mockResolvedValue(undefined);
    findOneAndUpdate.mockResolvedValue(null);
    const response = await POST(
      new NextRequest('http://localhost/api/payments/local/confirm', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({sessionId: created.id}),
      })
    );
    const payload = await response.json();
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(payload.confirmationUrl).toBeUndefined();
  });
});
