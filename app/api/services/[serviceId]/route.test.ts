import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NextRequest} from 'next/server';
import {resetServiceCatalogForTests, resolveServices} from '@/lib/serviceCatalog';

const getServerSession = vi.fn();
const dbConnect = vi.hoisted(() =>
  vi.fn().mockRejectedValue(new Error('no mongo in unit tests'))
);
const findOneAndUpdate = vi.hoisted(() => vi.fn());
const find = vi.hoisted(() => vi.fn());

vi.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => getServerSession(...args),
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

vi.mock('@/lib/dbConnect', () => ({
  default: dbConnect,
}));

vi.mock('@/app/models/provisionedService', () => ({
  default: {
    findOneAndUpdate: (...args: unknown[]) => findOneAndUpdate(...args),
    find: (...args: unknown[]) => ({lean: () => find(...args)}),
  },
}));

function patch(serviceId: string, body: Record<string, unknown>) {
  return new NextRequest(`http://localhost/api/services/${serviceId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

async function seedOwnedService() {
  const {POST} = await import('../route');
  const response = await POST(
    new NextRequest('http://localhost/api/services', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Retail Facial',
        price: 120,
        usdChargeCents: 4500,
        durationMinutes: 45,
        providerTypes: ['esthetician'],
        id: 'srv-owned',
      }),
    })
  );
  expect(response.status).toBe(200);
}

describe('PATCH /api/services/[serviceId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetServiceCatalogForTests();
    dbConnect.mockRejectedValue(new Error('no mongo in unit tests'));
    find.mockResolvedValue([]);
    findOneAndUpdate.mockResolvedValue({id: 'srv-owned'});
    getServerSession.mockResolvedValue({
      user: {stripeAccountId: 'acct_owner'},
    });
  });

  it('returns 404 and leaves the row unchanged for another account', async () => {
    await seedOwnedService();
    getServerSession.mockResolvedValue({
      user: {stripeAccountId: 'acct_other'},
    });

    const {PATCH} = await import('./route');
    const response = await PATCH(patch('srv-owned', {published: true, name: 'Stolen'}), {
      params: {serviceId: 'srv-owned'},
    });

    expect(response.status).toBe(404);
    getServerSession.mockResolvedValue({
      user: {stripeAccountId: 'acct_owner'},
    });
    const ownerView = await resolveServices('acct_owner', 'treatment');
    const owned = ownerView.find((service) => service.id === 'srv-owned');
    expect(owned?.name).toBe('Retail Facial');
    expect(owned?.published).toBe(false);
  });

  it('publishes and unpublishes only the owner row', async () => {
    await seedOwnedService();
    const {PATCH} = await import('./route');

    const published = await PATCH(patch('srv-owned', {published: true}), {
      params: {serviceId: 'srv-owned'},
    });
    expect(published.status).toBe(200);
    expect((await resolveServices('acct_owner', 'storefront')).map((service) => service.id)).toEqual([
      'srv-owned',
    ]);

    const unpublished = await PATCH(patch('srv-owned', {published: false}), {
      params: {serviceId: 'srv-owned'},
    });
    expect(unpublished.status).toBe(200);
    expect(await resolveServices('acct_owner', 'storefront')).toEqual([]);
  });

  it('keeps the previous published state when the Mongo mirror fails', async () => {
    await seedOwnedService();
    const {PATCH} = await import('./route');
    await PATCH(patch('srv-owned', {published: true}), {
      params: {serviceId: 'srv-owned'},
    });

    dbConnect.mockResolvedValue(undefined);
    findOneAndUpdate.mockRejectedValue(new Error('mirror failed'));
    find.mockResolvedValue([
      {
        operatorAccountId: 'acct_owner',
        id: 'srv-owned',
        name: 'Retail Facial',
        published: true,
      },
    ]);

    const response = await PATCH(patch('srv-owned', {published: false}), {
      params: {serviceId: 'srv-owned'},
    });

    expect(response.status).toBeGreaterThanOrEqual(400);
    const storefront = await resolveServices('acct_owner', 'storefront');
    expect(storefront.map((service) => service.id)).toEqual(['srv-owned']);
  });

  it('does not let an older Mongo published row override a newer in-memory unpublish', async () => {
    await seedOwnedService();
    const {PATCH} = await import('./route');
    await PATCH(patch('srv-owned', {published: true}), {
      params: {serviceId: 'srv-owned'},
    });
    await PATCH(patch('srv-owned', {published: false}), {
      params: {serviceId: 'srv-owned'},
    });

    dbConnect.mockResolvedValue(undefined);
    find.mockResolvedValue([
      {
        operatorAccountId: 'acct_owner',
        id: 'srv-owned',
        name: 'Retail Facial',
        published: true,
      },
    ]);

    expect(await resolveServices('acct_owner', 'storefront')).toEqual([]);
  });
});
