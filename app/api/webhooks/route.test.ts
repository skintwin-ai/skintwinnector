import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NextRequest} from 'next/server';
import {
  findMarketplaceOrderBySession,
  marketplaceOrderSaveCount,
  resetMarketplaceOrdersForTests,
  saveMarketplaceOrder,
} from '@/lib/marketplaceOrders';

const constructEvent = vi.fn();
const sessionsRetrieve = vi.fn();
const dbConnect = vi.hoisted(() =>
  vi.fn().mockRejectedValue(new Error('no mongo in unit tests'))
);
const findOneAndUpdate = vi.hoisted(() => vi.fn());

const markBookingPayment = vi.fn().mockResolvedValue({});

vi.mock('@/lib/clinicRecords', () => ({
  markBookingPayment: (...args: unknown[]) => markBookingPayment(...args),
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

vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: {
      constructEvent: (...args: unknown[]) => constructEvent(...args),
    },
    checkout: {
      sessions: {retrieve: (...args: unknown[]) => sessionsRetrieve(...args)},
    },
  },
}));

function postRequest(signature?: string) {
  return new NextRequest('http://localhost/api/webhooks', {
    method: 'POST',
    headers: signature ? {'stripe-signature': signature} : undefined,
    body: '{"id":"evt_1"}',
  });
}

describe('POST /api/webhooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMarketplaceOrdersForTests();
    dbConnect.mockRejectedValue(new Error('no mongo in unit tests'));
    findOneAndUpdate.mockResolvedValue({id: 'ord_1'});
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    sessionsRetrieve.mockResolvedValue({
      id: 'cs_test_1',
      payment_status: 'paid',
      metadata: {draftId: 'draft-1', operatorAccountId: 'acct_123'},
    });
  });

  it('retrieves and logs a completed Connect booking checkout', async () => {
    constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      account: 'acct_123',
      data: {
        object: {
          id: 'cs_test_1',
          metadata: {draftId: 'draft-1', operatorAccountId: 'acct_123'},
        },
      },
    });
    const {POST} = await import('./route');
    const response = await POST(postRequest('sig_valid'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({});
    expect(sessionsRetrieve).toHaveBeenCalledWith(
      'cs_test_1',
      {},
      {stripeAccount: 'acct_123'}
    );
    expect(markBookingPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        checkoutSessionId: 'cs_test_1',
        operatorAccountId: 'acct_123',
        paymentStatus: 'paid',
      })
    );
  });

  it('ignores a platform event without event.account', async () => {
    constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_1',
          metadata: {draftId: 'draft-1', operatorAccountId: 'acct_123'},
        },
      },
    });
    const {POST} = await import('./route');
    await POST(postRequest('sig_valid'));
    expect(sessionsRetrieve).not.toHaveBeenCalled();
  });

  it('ignores a completed event without a booking draftId', async () => {
    constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      account: 'acct_123',
      data: {object: {id: 'cs_test_1'}},
    });
    sessionsRetrieve.mockResolvedValue({
      id: 'cs_test_1',
      payment_status: 'paid',
      metadata: {operatorAccountId: 'acct_123'},
    });
    const {POST} = await import('./route');
    await POST(postRequest('sig_valid'));
    expect(sessionsRetrieve).not.toHaveBeenCalled();
  });

  it('does not treat an unpaid retrieve as paid', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      account: 'acct_123',
      data: {
        object: {
          id: 'cs_test_1',
          metadata: {draftId: 'draft-1', operatorAccountId: 'acct_123'},
        },
      },
    });
    sessionsRetrieve.mockResolvedValue({
      id: 'cs_test_1',
      payment_status: 'unpaid',
      metadata: {draftId: 'draft-1', operatorAccountId: 'acct_123'},
    });
    const {POST} = await import('./route');
    await POST(postRequest('sig_valid'));
    expect(log).toHaveBeenCalledWith(
      'Booking checkout webhook',
      expect.objectContaining({paymentStatus: 'unpaid'})
    );
    expect(
      log.mock.calls.some((call) => call[1]?.paymentStatus === 'paid')
    ).toBe(false);
    log.mockRestore();
  });

  it('verifies with the Connect secret when the platform secret is unset', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET = 'whsec_connect';
    constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      account: 'acct_123',
      data: {
        object: {
          id: 'cs_test_1',
          metadata: {draftId: 'draft-1', operatorAccountId: 'acct_123'},
        },
      },
    });
    const {POST} = await import('./route');
    const response = await POST(postRequest('sig_valid'));
    expect(response.status).toBe(200);
    expect(constructEvent).toHaveBeenCalledWith(
      '{"id":"evt_1"}',
      'sig_valid',
      'whsec_connect'
    );
  });

  it('still acknowledges when retrieve throws after a valid signature', async () => {
    constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      account: 'acct_123',
      data: {
        object: {
          id: 'cs_test_1',
          metadata: {draftId: 'draft-1', operatorAccountId: 'acct_123'},
        },
      },
    });
    sessionsRetrieve.mockRejectedValue(new Error('stripe down'));
    const {POST} = await import('./route');
    const response = await POST(postRequest('sig_valid'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({});
  });

  it('returns 400 when the signature is missing', async () => {
    const {POST} = await import('./route');
    const response = await POST(postRequest());
    expect(response.status).toBe(400);
    expect(constructEvent).not.toHaveBeenCalled();
  });

  async function storeMarketplaceOrder() {
    await saveMarketplaceOrder({
      id: 'ord_1',
      sellerAccountId: 'acct_seller',
      buyerAccountId: 'acct_buyer',
      checkoutSessionId: 'cs_market_1',
      checkoutUrl: 'https://checkout.example/cs_market_1',
      currency: 'usd',
      merchandiseTotal: 2500,
      amountTotal: null,
      paymentStatus: 'unpaid',
      lines: [
        {
          serviceId: 'srv-live',
          name: 'Retail Facial',
          quantity: 1,
          unitAmount: 2500,
        },
      ],
      mismatch: null,
      idempotencyKey:
        'marketplace-checkout:acct_buyer:acct_seller:srv-live:1:2500',
    });
  }

  function marketplaceEvent(account = 'acct_seller') {
    return {
      type: 'checkout.session.completed',
      account,
      data: {
        object: {
          id: 'cs_market_1',
          metadata: {orderKind: 'marketplace'},
        },
      },
    };
  }

  it('marks a paid marketplace order without settling a treatment booking', async () => {
    await storeMarketplaceOrder();
    constructEvent.mockReturnValue(marketplaceEvent());
    sessionsRetrieve.mockResolvedValue({
      id: 'cs_market_1',
      payment_status: 'paid',
      currency: 'usd',
      amount_subtotal: 2500,
      amount_total: 2500,
      metadata: {orderKind: 'marketplace'},
    });
    const {POST} = await import('./route');
    const response = await POST(postRequest('sig_valid'));
    expect(response.status).toBe(200);
    expect(markBookingPayment).not.toHaveBeenCalled();
    const stored = await findMarketplaceOrderBySession(
      'acct_seller',
      'cs_market_1'
    );
    expect(stored?.paymentStatus).toBe('paid');
    expect(stored?.amountTotal).toBe(2500);
  });

  it('does not write a paid marketplace order a second time', async () => {
    await storeMarketplaceOrder();
    constructEvent.mockReturnValue(marketplaceEvent());
    sessionsRetrieve.mockResolvedValue({
      id: 'cs_market_1',
      payment_status: 'paid',
      currency: 'usd',
      amount_subtotal: 2500,
      amount_total: 2500,
      metadata: {},
    });
    const {POST} = await import('./route');
    await POST(postRequest('sig_valid'));
    const writes = marketplaceOrderSaveCount();
    const response = await POST(postRequest('sig_valid'));
    expect(response.status).toBe(200);
    expect(marketplaceOrderSaveCount()).toBe(writes);
  });

  it('stores a taxed total without treating tax as a mismatch', async () => {
    await storeMarketplaceOrder();
    constructEvent.mockReturnValue(marketplaceEvent());
    sessionsRetrieve.mockResolvedValue({
      id: 'cs_market_1',
      payment_status: 'paid',
      currency: 'usd',
      amount_subtotal: 2500,
      amount_total: 2750,
      metadata: {},
    });
    const {POST} = await import('./route');
    const response = await POST(postRequest('sig_valid'));
    expect(response.status).toBe(200);
    const stored = await findMarketplaceOrderBySession(
      'acct_seller',
      'cs_market_1'
    );
    expect(stored?.paymentStatus).toBe('paid');
    expect(stored?.amountTotal).toBe(2750);
  });

  it('acknowledges a merchandise mismatch without marking the order paid', async () => {
    await storeMarketplaceOrder();
    constructEvent.mockReturnValue(marketplaceEvent());
    sessionsRetrieve.mockResolvedValue({
      id: 'cs_market_1',
      payment_status: 'paid',
      currency: 'usd',
      amount_subtotal: 1000,
      amount_total: 1000,
      metadata: {},
    });
    const {POST} = await import('./route');
    const response = await POST(postRequest('sig_valid'));
    expect(response.status).toBe(200);
    const stored = await findMarketplaceOrderBySession(
      'acct_seller',
      'cs_market_1'
    );
    expect(stored?.paymentStatus).toBe('mismatch');
  });

  it('leaves an unpaid marketplace session unpaid', async () => {
    await storeMarketplaceOrder();
    constructEvent.mockReturnValue(marketplaceEvent());
    sessionsRetrieve.mockResolvedValue({
      id: 'cs_market_1',
      payment_status: 'unpaid',
      currency: 'usd',
      amount_subtotal: 2500,
      amount_total: 2500,
      metadata: {},
    });
    const {POST} = await import('./route');
    const response = await POST(postRequest('sig_valid'));
    expect(response.status).toBe(200);
    const stored = await findMarketplaceOrderBySession(
      'acct_seller',
      'cs_market_1'
    );
    expect(stored?.paymentStatus).toBe('unpaid');
  });

  it('returns non-2xx when the marketplace update fails', async () => {
    await storeMarketplaceOrder();
    dbConnect.mockResolvedValue(undefined);
    findOneAndUpdate.mockResolvedValue(null);
    constructEvent.mockReturnValue(marketplaceEvent());
    sessionsRetrieve.mockResolvedValue({
      id: 'cs_market_1',
      payment_status: 'paid',
      currency: 'usd',
      amount_subtotal: 2500,
      amount_total: 2500,
      metadata: {},
    });
    const {POST} = await import('./route');
    const response = await POST(postRequest('sig_valid'));
    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('returns non-2xx when marketplace retrieve throws', async () => {
    await storeMarketplaceOrder();
    constructEvent.mockReturnValue(marketplaceEvent());
    sessionsRetrieve.mockRejectedValue(new Error('stripe down'));
    const {POST} = await import('./route');
    const response = await POST(postRequest('sig_valid'));
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(markBookingPayment).not.toHaveBeenCalled();
  });

  it('does not change an order when the event account is a different salon', async () => {
    await storeMarketplaceOrder();
    constructEvent.mockReturnValue(marketplaceEvent('acct_other'));
    const {POST} = await import('./route');
    const response = await POST(postRequest('sig_valid'));
    expect(response.status).toBe(200);
    expect(markBookingPayment).not.toHaveBeenCalled();
    const stored = await findMarketplaceOrderBySession(
      'acct_seller',
      'cs_market_1'
    );
    expect(stored?.paymentStatus).toBe('unpaid');
  });

  it('returns 400 when the signature is invalid', async () => {
    constructEvent.mockImplementation(() => {
      throw new Error('Invalid signature');
    });
    const {POST} = await import('./route');
    const response = await POST(postRequest('sig_bad'));
    expect(response.status).toBe(400);
  });
});
