import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {
  createLocalStripe,
  getLocalCheckoutSession,
  isLocalStripeKey,
  localAccountIdForEmail,
  payLocalCheckoutSession,
  resetLocalStripeForTests,
} from './localStripeRail';

describe('local Stripe rail', () => {
  afterEach(() => {
    resetLocalStripeForTests();
    delete process.env.SKINTWIN_LOCAL_STRIPE_STORE;
  });

  beforeEach(() => {
    process.env.SKINTWIN_LOCAL_STRIPE_STORE = `/tmp/skintwin-local-stripe-test-${process.pid}.json`;
    resetLocalStripeForTests();
  });

  it('treats placeholder secrets as the local rail', () => {
    expect(isLocalStripeKey('sk_test_placeholder')).toBe(true);
    expect(isLocalStripeKey('sk_test_51ABCDEFrealenoughkey')).toBe(false);
    expect(localAccountIdForEmail('demo@skintwin.ai')).toBe(
      'acct_local_demo_skintwin_ai'
    );
  });

  it('creates, pays, and retrieves a checkout session', async () => {
    process.env.NEXTAUTH_URL = 'http://localhost:3000';
    const stripe = createLocalStripe();
    const created = await stripe.checkout.sessions.create(
      {
        customer_email: 'adaeze.obi@example.com',
        metadata: {draftId: 'draft-1', operatorAccountId: 'acct_local_demo'},
        line_items: [
          {
            quantity: 1,
            price_data: {unit_amount: 8500, currency: 'usd'},
          },
        ],
      },
      {stripeAccount: 'acct_local_demo'}
    );
    expect(created.id.startsWith('cs_')).toBe(true);
    expect(created.url).toBe(`http://localhost:3000/pay/local/${created.id}`);
    expect(created.payment_status).toBe('unpaid');
    expect(payLocalCheckoutSession(created.id)?.payment_status).toBe('paid');
    const retrieved = await stripe.checkout.sessions.retrieve(
      created.id,
      {},
      {stripeAccount: 'acct_local_demo'}
    );
    expect(retrieved.payment_status).toBe('paid');
    expect(retrieved.amount_total).toBe(8500);
    expect(getLocalCheckoutSession(created.id)?.payment_status).toBe('paid');
  });
});
