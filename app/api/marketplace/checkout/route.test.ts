import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NextRequest} from 'next/server';
import {applicationFeeAmount} from '@/lib/bookingCheckout';
import {
  claimSalonSlug,
  resetServiceCatalogForTests,
  saveProvisionedService,
} from '@/lib/serviceCatalog';
import {resetMarketplaceOrdersForTests} from '@/lib/marketplaceOrders';

const getServerSession = vi.fn();
const accountsRetrieve = vi.fn();
const taxRetrieve = vi.fn();
const sessionsCreate = vi.fn();
const controls = vi.hoisted(() => ({failSave: false}));

vi.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => getServerSession(...args),
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

vi.mock('@/lib/dbConnect', () => ({
  default: vi.fn().mockRejectedValue(new Error('no mongo in unit tests')),
}));

vi.mock('@/lib/stripe', () => ({
  stripe: {
    accounts: {retrieve: (...args: unknown[]) => accountsRetrieve(...args)},
    tax: {settings: {retrieve: (...args: unknown[]) => taxRetrieve(...args)}},
    checkout: {
      sessions: {create: (...args: unknown[]) => sessionsCreate(...args)},
    },
  },
}));

vi.mock('@/lib/marketplaceOrders', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/marketplaceOrders')
  >('@/lib/marketplaceOrders');
  return {
    ...actual,
    saveMarketplaceOrder: async (
      ...args: Parameters<typeof actual.saveMarketplaceOrder>
    ) => {
      if (controls.failSave) {
        return null;
      }
      return actual.saveMarketplaceOrder(...args);
    },
  };
});

function postCheckout(body: unknown) {
  return new NextRequest('http://localhost/api/marketplace/checkout', {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify(body),
  });
}

async function publishSellerService() {
  claimSalonSlug('acct_seller', 'ada');
  await saveProvisionedService({
    operatorAccountId: 'acct_seller',
    id: 'srv-live',
    name: 'Retail Facial',
    category: 'facials',
    description: 'Published',
    durationMinutes: 45,
    bufferMinutes: 0,
    price: 120,
    usdChargeCents: 2500,
    currency: 'NGN',
    providerTypes: ['esthetician'],
    requiresConsultation: false,
    addOns: ['srv-addon'],
    image: 'live.png',
    published: true,
  });
}

describe('POST /api/marketplace/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    controls.failSave = false;
    resetServiceCatalogForTests();
    resetMarketplaceOrdersForTests();
    process.env.NEXTAUTH_URL = 'http://localhost:3000';
    getServerSession.mockResolvedValue({
      user: {stripeAccountId: 'acct_buyer'},
    });
    accountsRetrieve.mockResolvedValue({
      id: 'acct_seller',
      default_currency: 'usd',
      charges_enabled: true,
      capabilities: {card_payments: 'active'},
    });
    taxRetrieve.mockResolvedValue({status: 'inactive', defaults: {}});
    sessionsCreate.mockResolvedValue({
      id: 'cs_market_1',
      url: 'https://checkout.stripe.com/c/pay/cs_market_1',
    });
  });

  it('charges the seller account and stores an unpaid order', async () => {
    await publishSellerService();
    const {POST} = await import('./route');
    const response = await POST(
      postCheckout({
        slug: 'ada',
        services: [
          {serviceId: 'srv-live', quantity: 11, addOns: ['srv-addon']},
        ],
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.checkoutUrl).toBe(
      'https://checkout.stripe.com/c/pay/cs_market_1'
    );
    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_intent_data: {
          application_fee_amount: applicationFeeAmount(2500 * 11),
        },
        line_items: [
          expect.objectContaining({
            quantity: 11,
            price_data: expect.objectContaining({
              currency: 'usd',
              unit_amount: 2500,
            }),
          }),
        ],
      }),
      expect.objectContaining({
        stripeAccount: 'acct_seller',
        idempotencyKey: expect.stringContaining(
          'marketplace-checkout:acct_buyer:acct_seller'
        ),
      })
    );
    const params = sessionsCreate.mock.calls[0][0];
    expect(params.transfer_data).toBeUndefined();
    expect(params.customer).toBeUndefined();
    expect(params.metadata.draftId).toBeUndefined();
    expect(params.metadata.orderKind).toBe('marketplace');
    expect(params.line_items).toHaveLength(1);
    expect(params.success_url).toContain('/market/orders/');
    expect(params.success_url).not.toContain('/bookings/confirmation');

    const {findMarketplaceOrderBySession} = await import(
      '@/lib/marketplaceOrders'
    );
    const stored = await findMarketplaceOrderBySession(
      'acct_seller',
      'cs_market_1'
    );
    expect(stored).toMatchObject({
      sellerAccountId: 'acct_seller',
      buyerAccountId: 'acct_buyer',
      checkoutSessionId: 'cs_market_1',
      paymentStatus: 'unpaid',
      merchandiseTotal: 2500 * 11,
    });
  });

  it('rejects a buyer purchasing from their own salon', async () => {
    await publishSellerService();
    getServerSession.mockResolvedValue({
      user: {stripeAccountId: 'acct_seller'},
    });
    const {POST} = await import('./route');
    const response = await POST(
      postCheckout({
        slug: 'ada',
        services: [{serviceId: 'srv-live', quantity: 1}],
      })
    );
    expect(response.status).toBe(400);
    expect(sessionsCreate).not.toHaveBeenCalled();
    expect(accountsRetrieve).not.toHaveBeenCalled();
  });

  it('rejects a live seller that cannot charge and allows the local stand-in', async () => {
    await publishSellerService();
    accountsRetrieve.mockResolvedValue({
      id: 'acct_seller',
      default_currency: 'usd',
      charges_enabled: false,
      capabilities: {card_payments: 'inactive'},
    });
    const {POST} = await import('./route');
    const blocked = await POST(
      postCheckout({
        slug: 'ada',
        services: [{serviceId: 'srv-live', quantity: 1}],
      })
    );
    expect(blocked.status).toBe(400);
    expect(sessionsCreate).not.toHaveBeenCalled();

    accountsRetrieve.mockResolvedValue({
      id: 'acct_seller',
      default_currency: 'usd',
    });
    const allowed = await POST(
      postCheckout({
        slug: 'ada',
        services: [{serviceId: 'srv-live', quantity: 1}],
      })
    );
    expect(allowed.status).toBe(200);
  });

  it('rejects client prices, unpublished services, and unsupported currency', async () => {
    await publishSellerService();
    await saveProvisionedService({
      operatorAccountId: 'acct_seller',
      id: 'srv-draft',
      name: 'Draft',
      category: 'facials',
      description: 'Hidden',
      durationMinutes: 30,
      bufferMinutes: 0,
      price: 10,
      usdChargeCents: 1000,
      currency: 'NGN',
      providerTypes: ['esthetician'],
      requiresConsultation: false,
      addOns: [],
      image: 'draft.png',
      published: false,
    });
    const {POST} = await import('./route');
    const priced = await POST(
      postCheckout({
        slug: 'ada',
        unit_amount: 1,
        services: [{serviceId: 'srv-live', quantity: 1}],
      })
    );
    expect(priced.status).toBe(400);

    const unpublished = await POST(
      postCheckout({
        slug: 'ada',
        services: [{serviceId: 'srv-draft', quantity: 1}],
      })
    );
    expect(unpublished.status).toBe(400);

    accountsRetrieve.mockResolvedValue({
      id: 'acct_seller',
      default_currency: 'eur',
      charges_enabled: true,
      capabilities: {card_payments: 'active'},
    });
    const euros = await POST(
      postCheckout({
        slug: 'ada',
        services: [{serviceId: 'srv-live', quantity: 1}],
      })
    );
    expect(euros.status).toBe(400);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it('reuses the unpaid order for the same priced lines', async () => {
    await publishSellerService();
    const {POST} = await import('./route');
    const body = {
      slug: 'ada',
      services: [{serviceId: 'srv-live', quantity: 1}],
    };
    const first = await POST(postCheckout(body));
    const second = await POST(postCheckout(body));
    expect(first.status).toBe(200);
    expect(await second.json()).toEqual(await first.json());
    expect(sessionsCreate).toHaveBeenCalledTimes(1);
  });

  it('returns 500 and no checkout URL when the order save fails', async () => {
    await publishSellerService();
    controls.failSave = true;
    const {POST} = await import('./route');
    const response = await POST(
      postCheckout({
        slug: 'ada',
        services: [{serviceId: 'srv-live', quantity: 1}],
      })
    );
    const json = await response.json();
    expect(response.status).toBe(500);
    expect(json.checkoutUrl).toBeUndefined();
  });
});
