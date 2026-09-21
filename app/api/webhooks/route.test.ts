import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NextRequest} from 'next/server';

const constructEvent = vi.fn();
const sessionsRetrieve = vi.fn();

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
      data: {object: {id: 'cs_test_1', metadata: {draftId: 'draft-1'}}},
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
  });

  it('ignores a platform event without event.account', async () => {
    constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {object: {id: 'cs_test_1', metadata: {draftId: 'draft-1'}}},
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
    expect(sessionsRetrieve).toHaveBeenCalled();
  });

  it('does not treat an unpaid retrieve as paid', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      account: 'acct_123',
      data: {object: {id: 'cs_test_1', metadata: {draftId: 'draft-1'}}},
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

  it('returns 400 when the signature is missing', async () => {
    const {POST} = await import('./route');
    const response = await POST(postRequest());
    expect(response.status).toBe(400);
    expect(constructEvent).not.toHaveBeenCalled();
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
