import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NextRequest} from 'next/server';

const getServerSession = vi.fn();
const accountsRetrieve = vi.fn();
const taxRetrieve = vi.fn();
const sessionsCreate = vi.fn();

vi.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => getServerSession(...args),
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

const persistCheckoutBooking = vi.fn().mockResolvedValue({});

vi.mock('@/lib/clinicRecords', () => ({
  persistCheckoutBooking: (...args: unknown[]) =>
    persistCheckoutBooking(...args),
}));

vi.mock('@/lib/stripe', () => ({
  stripe: {
    accounts: {retrieve: (...args: unknown[]) => accountsRetrieve(...args)},
    tax: {settings: {retrieve: (...args: unknown[]) => taxRetrieve(...args)}},
    checkout: {
      sessions: {
        create: (...args: unknown[]) => sessionsCreate(...args),
        expire: vi.fn().mockResolvedValue({}),
      },
    },
  },
}));

const validBody = {
  draftId: 'draft-1',
  services: [{serviceId: 'srv-001', quantity: 1, addOns: []}],
  appointment: {
    date: '2026-09-22',
    startTime: '10:00',
    endTime: '11:15',
    providerId: 'prv-001',
    totalDurationMinutes: 75,
  },
  client: {
    firstName: 'Adaeze',
    lastName: 'Obi',
    email: 'adaeze.obi@example.com',
    phone: '+2348012345678',
  },
};

function postRequest(body: unknown) {
  return new NextRequest(
    'http://localhost/api/bookings/create_checkout_session',
    {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify(body),
    }
  );
}

describe('POST /api/bookings/create_checkout_session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXTAUTH_URL = 'http://localhost:3000';
    getServerSession.mockResolvedValue({
      user: {stripeAccountId: 'acct_123'},
    });
    accountsRetrieve.mockResolvedValue({default_currency: 'usd'});
    taxRetrieve.mockResolvedValue({status: 'inactive', defaults: {}});
    sessionsCreate.mockResolvedValue({
      id: 'cs_test_1',
      url: 'https://checkout.stripe.com/c/pay/cs_test_1',
    });
  });

  it('creates a direct-charge session with server-built unit amounts', async () => {
    const {POST} = await import('./route');
    const response = await POST(postRequest(validBody));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_1',
      sessionId: 'cs_test_1',
    });
    expect(persistCheckoutBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        operatorAccountId: 'acct_123',
        draftId: 'draft-1',
        checkoutSessionId: 'cs_test_1',
      })
    );
    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        customer_email: 'adaeze.obi@example.com',
        payment_intent_data: {application_fee_amount: 850},
        line_items: [
          expect.objectContaining({
            quantity: 1,
            price_data: expect.objectContaining({
              currency: 'usd',
              unit_amount: 8500,
            }),
          }),
        ],
        success_url:
          'http://localhost:3000/bookings/confirmation?session_id={CHECKOUT_SESSION_ID}',
      }),
      expect.objectContaining({
        stripeAccount: 'acct_123',
        idempotencyKey: 'booking-checkout:draft-1',
      })
    );
  });

  it('returns 401 and does not call Stripe without a session', async () => {
    getServerSession.mockResolvedValue(null);
    const {POST} = await import('./route');
    const response = await POST(postRequest(validBody));
    expect(response.status).toBe(401);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when the body includes a client price field', async () => {
    const {POST} = await import('./route');
    const response = await POST(postRequest({...validBody, unit_amount: 1000}));
    expect(response.status).toBe(400);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it('returns 400 for an empty service list', async () => {
    const {POST} = await import('./route');
    const response = await POST(postRequest({...validBody, services: []}));
    expect(response.status).toBe(400);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it('returns 400 for quantity 11', async () => {
    const {POST} = await import('./route');
    const response = await POST(
      postRequest({
        ...validBody,
        services: [{serviceId: 'srv-001', quantity: 11, addOns: []}],
      })
    );
    expect(response.status).toBe(400);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it('charges NGN connected accounts in kobo with a platform fee', async () => {
    accountsRetrieve.mockResolvedValue({default_currency: 'ngn'});
    const {POST} = await import('./route');
    const response = await POST(postRequest(validBody));
    expect(response.status).toBe(200);
    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_intent_data: {application_fee_amount: 85000},
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({
              currency: 'ngn',
              unit_amount: 850000,
            }),
          }),
        ],
      }),
      expect.objectContaining({stripeAccount: 'acct_123'})
    );
  });

  it('returns 400 when the connected account currency is unsupported', async () => {
    accountsRetrieve.mockResolvedValue({default_currency: 'eur'});
    const {POST} = await import('./route');
    const response = await POST(postRequest(validBody));
    expect(response.status).toBe(400);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when the connected account currency is missing', async () => {
    accountsRetrieve.mockResolvedValue({});
    const {POST} = await import('./route');
    const response = await POST(postRequest(validBody));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Unsupported charge currency: undefined',
    });
    expect(sessionsCreate).not.toHaveBeenCalled();
    expect(persistCheckoutBooking).not.toHaveBeenCalled();
  });

  it('uses a suffixed Idempotency-Key on retryAttempt 2', async () => {
    const {POST} = await import('./route');
    await POST(postRequest({...validBody, retryAttempt: 2}));
    expect(sessionsCreate.mock.calls[0][1].idempotencyKey).toBe(
      'booking-checkout:draft-1:2'
    );
  });

  it('fails closed when tax settings cannot be retrieved', async () => {
    taxRetrieve.mockRejectedValue(new Error('tax unavailable'));
    const {POST} = await import('./route');
    const response = await POST(postRequest(validBody));
    expect(response.status).toBe(500);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it('sends the same Idempotency-Key for two POSTs with the same draftId', async () => {
    const {POST} = await import('./route');
    await POST(postRequest(validBody));
    await POST(postRequest(validBody));
    const keys = sessionsCreate.mock.calls.map(
      (call) => call[1].idempotencyKey
    );
    expect(keys).toEqual([
      'booking-checkout:draft-1',
      'booking-checkout:draft-1',
    ]);
  });
});
