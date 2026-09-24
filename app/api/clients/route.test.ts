import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NextRequest} from 'next/server';

const getServerSession = vi.fn();
const listClinicClients = vi.fn();
const upsertClinicClient = vi.fn();

vi.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => getServerSession(...args),
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

vi.mock('@/lib/clinicRecords', () => ({
  listClinicClients: (...args: unknown[]) => listClinicClients(...args),
  upsertClinicClient: (...args: unknown[]) => upsertClinicClient(...args),
}));

describe('GET/POST /api/clients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerSession.mockResolvedValue({user: {stripeAccountId: 'acct_123'}});
    listClinicClients.mockResolvedValue([{id: 'cli_1', email: 'a@b.com'}]);
    upsertClinicClient.mockResolvedValue({id: 'cli_1', email: 'a@b.com'});
  });

  it('lists clients for the operator', async () => {
    const {GET} = await import('./route');
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      clients: [{id: 'cli_1', email: 'a@b.com'}],
    });
  });

  it('returns 401 without a Stripe account', async () => {
    getServerSession.mockResolvedValue(null);
    const {GET} = await import('./route');
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it('upserts a client', async () => {
    const {POST} = await import('./route');
    const response = await POST(
      new NextRequest('http://localhost/api/clients', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'Ada',
          lastName: 'Obi',
          email: 'ada@example.com',
          phone: '+2348012345678',
          consentAccepted: true,
        }),
      })
    );
    expect(response.status).toBe(200);
    expect(upsertClinicClient).toHaveBeenCalledWith(
      expect.objectContaining({
        operatorAccountId: 'acct_123',
        client: expect.objectContaining({email: 'ada@example.com'}),
      })
    );
  });
});
