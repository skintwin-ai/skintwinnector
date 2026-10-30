import {beforeEach, describe, expect, it, vi} from 'vitest';
import {
  loadMarketplaceReceipt,
  resetMarketplaceOrdersForTests,
  saveMarketplaceOrder,
} from './marketplaceOrders';

const sessionsRetrieve = vi.fn();

vi.mock('@/lib/dbConnect', () => ({
  default: vi.fn().mockRejectedValue(new Error('no mongo in unit tests')),
}));

vi.mock('@/lib/stripe', () => ({
  stripe: {
    checkout: {
      sessions: {retrieve: (...args: unknown[]) => sessionsRetrieve(...args)},
    },
  },
}));

describe('marketplace receipt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMarketplaceOrdersForTests();
    sessionsRetrieve.mockResolvedValue({
      id: 'cs_market_1',
      payment_status: 'unpaid',
    });
  });

  it('retrieves the session on the seller account for the buyer only', async () => {
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
        {serviceId: 'srv-live', name: 'Retail', quantity: 1, unitAmount: 2500},
      ],
      mismatch: null,
      idempotencyKey: 'marketplace-checkout:receipt',
    });

    const loaded = await loadMarketplaceReceipt('ord_1', 'acct_buyer');
    expect(loaded?.order.paymentStatus).toBe('unpaid');
    expect(sessionsRetrieve).toHaveBeenCalledWith(
      'cs_market_1',
      {},
      {
        stripeAccount: 'acct_seller',
      }
    );
    expect(await loadMarketplaceReceipt('ord_1', 'acct_other')).toBeNull();
  });
});
