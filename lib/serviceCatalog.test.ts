import {readFileSync} from 'node:fs';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import servicesData from '@/app/data/services.json';
import type {Service} from '@/app/contexts/booking/types';
import {
  claimSalonSlug,
  formatStorefrontAmount,
  listIndexSalons,
  loadMarketplaceIndex,
  resetServiceCatalogForTests,
  resolveServices,
  salonBySlug,
  saveProvisionedService,
} from './serviceCatalog';

vi.mock('@/lib/dbConnect', () => ({
  default: vi.fn().mockRejectedValue(new Error('no mongo in unit tests')),
}));

const sharedIds = (servicesData as Service[]).map((service) => service.id);

function storedService(
  operatorAccountId: string,
  id: string,
  published: boolean
): Service & {operatorAccountId: string; published: boolean} {
  return {
    operatorAccountId,
    id,
    name: `Service ${id}`,
    category: 'facials',
    description: 'Stored service',
    durationMinutes: 30,
    bufferMinutes: 0,
    price: 100,
    usdChargeCents: 2500,
    currency: 'NGN',
    providerTypes: ['esthetician'],
    requiresConsultation: false,
    addOns: [],
    image: 'stored.png',
    published,
  };
}

describe('serviceCatalog', () => {
  beforeEach(() => {
    resetServiceCatalogForTests();
  });

  it('resolves an account with no rows to the shared file in treatment mode and an empty storefront', async () => {
    const treatment = await resolveServices('acct_empty', 'treatment');
    const storefront = await resolveServices('acct_empty', 'storefront');

    expect(treatment.map((service) => service.id)).toEqual(sharedIds);
    expect(storefront).toEqual([]);
  });

  it('resolves one unpublished row as the only treatment service and an empty storefront', async () => {
    await saveProvisionedService(storedService('acct_a', 'srv-local', false));

    const treatment = await resolveServices('acct_a', 'treatment');
    const storefront = await resolveServices('acct_a', 'storefront');

    expect(treatment.map((service) => service.id)).toEqual(['srv-local']);
    expect(treatment[0]?.published).toBe(false);
    expect(storefront).toEqual([]);
  });

  it('returns only the published row in storefront mode', async () => {
    await saveProvisionedService(storedService('acct_a', 'srv-draft', false));
    await saveProvisionedService(storedService('acct_a', 'srv-live', true));

    const storefront = await resolveServices('acct_a', 'storefront');

    expect(storefront.map((service) => service.id)).toEqual(['srv-live']);
    expect(storefront[0]?.published).toBe(true);
  });

  it('keeps a second account out of both modes for the first account', async () => {
    await saveProvisionedService(storedService('acct_a', 'srv-a', true));
    await saveProvisionedService(storedService('acct_b', 'srv-b', true));

    const treatment = await resolveServices('acct_a', 'treatment');
    const storefront = await resolveServices('acct_a', 'storefront');

    expect(treatment.map((service) => service.id)).toEqual(['srv-a']);
    expect(storefront.map((service) => service.id)).toEqual(['srv-a']);
    expect(treatment.some((service) => service.id === 'srv-b')).toBe(false);
  });

  it('returns the in-memory row for that account when Mongo fails', async () => {
    await saveProvisionedService(storedService('acct_a', 'srv-a', false));
    await saveProvisionedService(storedService('acct_b', 'srv-b', true));

    const treatment = await resolveServices('acct_a', 'treatment');

    expect(treatment.map((service) => service.id)).toEqual(['srv-a']);
    expect(treatment.some((service) => service.id === 'srv-b')).toBe(false);
  });

  it('returns published services for a known slug and nothing for an unknown slug', async () => {
    claimSalonSlug('acct_a', 'Ada');
    await saveProvisionedService(storedService('acct_a', 'srv-draft', false));
    await saveProvisionedService(storedService('acct_a', 'srv-live', true));

    const salon = await salonBySlug('ada');
    expect(salon?.operatorAccountId).toBe('acct_a');
    expect(salon?.services.map((service) => service.id)).toEqual(['srv-live']);
    expect(await salonBySlug('missing')).toBeNull();
  });

  it('keeps an unpublished salon off the index and out of the shared file', async () => {
    claimSalonSlug('acct_a', 'ada');
    await saveProvisionedService(storedService('acct_a', 'srv-draft', false));

    const salon = await salonBySlug('ada');
    expect(salon?.services).toEqual([]);
    expect(await listIndexSalons()).toEqual([]);
  });

  it('lists a salon only when it has a slug and a published service', async () => {
    claimSalonSlug('acct_a', 'ada');
    await saveProvisionedService(storedService('acct_a', 'srv-live', true));
    await saveProvisionedService(storedService('acct_b', 'srv-b', true));

    const index = await listIndexSalons();
    expect(index.map((salon) => salon.slug)).toEqual(['ada']);
    expect(index[0]?.services.map((service) => service.id)).toEqual([
      'srv-live',
    ]);
  });

  it('loads the index without finished onboarding and hides it from a missing session', async () => {
    claimSalonSlug('acct_a', 'ada');
    await saveProvisionedService(storedService('acct_a', 'srv-live', true));

    expect(await loadMarketplaceIndex(null)).toBeNull();
    const listed = await loadMarketplaceIndex({
      user: {stripeAccountId: 'acct_a'},
    });
    expect(listed?.map((salon) => salon.slug)).toEqual(['ada']);
  });

  it('shows the seller currency amount in major units', () => {
    const service = storedService('acct_a', 'srv-live', true);
    expect(formatStorefrontAmount(service, 'usd')).toBe('25.00 USD');
    expect(formatStorefrontAmount(service, 'ngn')).toBe('100 NGN');
  });

  it('keeps the storefront page off the dashboard and the shared file', () => {
    const source = readFileSync('app/store/[slug]/page.tsx', 'utf8');
    expect(source).not.toContain('services.json');
    expect(source).not.toContain('(dashboard)');
    expect(source).toContain("dynamic = 'force-dynamic'");
    expect(source).not.toContain('generateStaticParams');
  });
});
