import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NextRequest} from 'next/server';

const getServerSession = vi.fn();
const sessionsRetrieve = vi.fn();

vi.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => getServerSession(...args),
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

vi.mock('@/lib/stripe', () => ({
  stripe: {
    checkout: {
      sessions: {retrieve: (...args: unknown[]) => sessionsRetrieve(...args)},
    },
  },
}));

function getRequest(sessionId?: string, extra?: Record<string, string>) {
  const url = new URL('http://localhost/api/bookings/checkout_session');
  if (sessionId) {
    url.searchParams.set('session_id', sessionId);
  }
  for (const [key, value] of Object.entries(extra || {})) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

describe('GET /api/bookings/checkout_session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerSession.mockResolvedValue({
      user: {stripeAccountId: 'acct_123'},
    });
    sessionsRetrieve.mockResolvedValue({
      id: 'cs_test_1',
      payment_status: 'paid',
      amount_total: 8500,
      currency: 'usd',
      payment_intent: 'pi_test_1',
      metadata: {operatorAccountId: 'acct_123', draftId: 'draft-1'},
    });
  });

  it('maps a paid retrieve to a Stripe-backed confirmation model', async () => {
    const {GET} = await import('./route');
    const response = await GET(getRequest('cs_test_1'));
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.paymentStatus).toBe('paid');
    expect(json.sessionId).toBe('cs_test_1');
    expect(json.paymentIntentId).toBe('pi_test_1');
    expect(sessionsRetrieve).toHaveBeenCalledWith(
      'cs_test_1',
      {},
      {stripeAccount: 'acct_123'}
    );
  });

  it('maps unpaid retrieve without marking it paid', async () => {
    sessionsRetrieve.mockResolvedValue({
      id: 'cs_test_1',
      payment_status: 'unpaid',
      amount_total: 8500,
      currency: 'usd',
      payment_intent: null,
      metadata: {operatorAccountId: 'acct_123', draftId: 'draft-1'},
    });
    const {GET} = await import('./route');
    const json = await (await GET(getRequest('cs_test_1'))).json();
    expect(json.paymentStatus).toBe('unpaid');
    expect(json.paymentStatus).not.toBe('paid');
  });

  it('returns 401 without a stripeAccount', async () => {
    getServerSession.mockResolvedValue({user: {}});
    const {GET} = await import('./route');
    const response = await GET(getRequest('cs_test_1'));
    expect(response.status).toBe(401);
    expect(sessionsRetrieve).not.toHaveBeenCalled();
  });

  it('returns 404 for a foreign account and ignores client stripeAccount', async () => {
    sessionsRetrieve.mockResolvedValue({
      id: 'cs_test_1',
      payment_status: 'paid',
      amount_total: 8500,
      currency: 'usd',
      payment_intent: 'pi_test_1',
      metadata: {operatorAccountId: 'acct_other', draftId: 'draft-1'},
    });
    const {GET} = await import('./route');
    const response = await GET(
      getRequest('cs_test_1', {stripeAccount: 'acct_other'})
    );
    expect(response.status).toBe(404);
    expect(sessionsRetrieve).toHaveBeenCalledWith(
      'cs_test_1',
      {},
      {stripeAccount: 'acct_123'}
    );
  });

  it('returns 404 for a non-cs_ id without calling Stripe', async () => {
    const {GET} = await import('./route');
    const response = await GET(getRequest('APT-12345678'));
    expect(response.status).toBe(404);
    expect(sessionsRetrieve).not.toHaveBeenCalled();
  });

  it('treats Stripe resource_missing as not-found, not unpaid', async () => {
    sessionsRetrieve.mockRejectedValue({
      code: 'resource_missing',
      statusCode: 404,
    });
    const {GET} = await import('./route');
    const response = await GET(getRequest('cs_missing'));
    const json = await response.json();
    expect(response.status).toBe(404);
    expect(json.paymentStatus).toBeUndefined();
  });
});
