import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NextRequest} from 'next/server';
import servicesData from '@/app/data/services.json';
import type {Service} from '@/app/contexts/booking/types';
import {
  resetServiceCatalogForTests,
  resolveServices,
  saveProvisionedService,
} from '@/lib/serviceCatalog';

const getServerSession = vi.fn();

vi.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => getServerSession(...args),
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

vi.mock('@/lib/dbConnect', () => ({
  default: vi.fn().mockRejectedValue(new Error('no mongo in unit tests')),
}));

const sharedIds = (servicesData as Service[]).map((service) => service.id);

function postService(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/services', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const validBody = {
  name: 'Retail Facial',
  price: 120,
  usdChargeCents: 4500,
  durationMinutes: 45,
  providerTypes: ['esthetician'],
};

describe('GET/POST /api/services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetServiceCatalogForTests();
    getServerSession.mockResolvedValue({
      user: {stripeAccountId: 'acct_123'},
    });
  });

  it('returns 401 and writes nothing without a Stripe account', async () => {
    getServerSession.mockResolvedValue(null);
    const {POST} = await import('./route');
    const response = await POST(postService(validBody));

    expect(response.status).toBe(401);
    expect((await response.json()).error).toBeTruthy();
    const treatment = await resolveServices('acct_123', 'treatment');
    expect(treatment.map((service) => service.id)).toEqual(sharedIds);
  });

  it('returns shared-file ids when the account has no rows', async () => {
    const {GET} = await import('./route');
    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.services.map((service: Service) => service.id)).toEqual(
      sharedIds
    );
  });

  it('returns only the unpublished row when one stored row exists', async () => {
    await saveProvisionedService({
      operatorAccountId: 'acct_123',
      id: 'srv-local',
      name: 'Local Facial',
      category: 'facials',
      description: 'Stored',
      durationMinutes: 30,
      bufferMinutes: 0,
      price: 100,
      usdChargeCents: 2500,
      currency: 'NGN',
      providerTypes: ['esthetician'],
      requiresConsultation: false,
      addOns: [],
      image: 'local.png',
      published: false,
    });

    const {GET} = await import('./route');
    const response = await GET();
    const body = await response.json();

    expect(body.services.map((service: Service) => service.id)).toEqual([
      'srv-local',
    ]);
  });

  it('stores a service on the session account and copies the shared file on the first create', async () => {
    const {POST} = await import('./route');
    const response = await POST(
      postService({
        ...validBody,
        unit_amount: 1,
        operatorAccountId: 'acct_evil',
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.service.operatorAccountId).toBe('acct_123');
    expect(body.service.price).toBe(120);
    expect(body.service.usdChargeCents).toBe(4500);
    expect(body.service.addOns).toEqual([]);
    expect(body.service.published).toBe(false);

    const treatment = await resolveServices('acct_123', 'treatment');
    const ids = treatment.map((service) => service.id);
    expect(ids).toEqual(expect.arrayContaining(sharedIds));
    expect(ids).toContain(body.service.id);
    expect(
      treatment
        .filter((service) => sharedIds.includes(service.id))
        .every((service) => service.published === false)
    ).toBe(true);
    expect(await resolveServices('acct_other', 'treatment')).toHaveLength(
      sharedIds.length
    );
  });

  it('does not copy the shared file again on a later create', async () => {
    const {POST} = await import('./route');
    await POST(postService(validBody));
    const second = await POST(
      postService({...validBody, name: 'Second Facial'})
    );
    const created = await second.json();
    const treatment = await resolveServices('acct_123', 'treatment');

    expect(treatment).toHaveLength(sharedIds.length + 2);
    expect(treatment.map((service) => service.id)).toContain(
      created.service.id
    );
  });

  it('returns 400 and stores nothing when usdChargeCents or providerTypes is missing', async () => {
    const {POST} = await import('./route');
    const missingCents = await POST(
      postService({
        name: 'Retail Facial',
        price: 120,
        durationMinutes: 45,
        providerTypes: ['esthetician'],
      })
    );
    const missingTypes = await POST(
      postService({
        name: 'Retail Facial',
        price: 120,
        usdChargeCents: 4500,
        durationMinutes: 45,
      })
    );

    expect(missingCents.status).toBe(400);
    expect(missingTypes.status).toBe(400);
    const treatment = await resolveServices('acct_123', 'treatment');
    expect(treatment.map((service) => service.id)).toEqual(sharedIds);
  });
});
