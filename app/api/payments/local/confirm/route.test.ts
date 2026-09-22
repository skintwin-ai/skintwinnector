import {beforeEach, describe, expect, it} from 'vitest';
import {NextRequest} from 'next/server';
import {
  createLocalStripe,
  resetLocalStripeForTests,
} from '@/lib/localStripeRail';
import {resetClinicRecordsForTests} from '@/lib/clinicRecords';
import {POST} from './route';

describe('POST /api/payments/local/confirm', () => {
  beforeEach(() => {
    resetLocalStripeForTests();
    resetClinicRecordsForTests();
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
    expect(payload.confirmationUrl).toContain(created.id);
  });
});
