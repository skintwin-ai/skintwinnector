import {describe, expect, it} from 'vitest';
import {
  DEFAULT_BRAND_NAME,
  DEFAULT_BRAND_STATEMENT_DESCRIPTOR,
  DEFAULT_BRAND_SUPPORT_EMAIL,
  DEFAULT_BRAND_URL,
} from '@/lib/brand';
import {DEMO_CUSTOMERS} from '@/app/data/demoCustomers';

describe('SkinTwin brand constants', () => {
  it('exposes SkinTwin display and statement branding', () => {
    expect(DEFAULT_BRAND_NAME).toBe('SkinTwin');
    expect(DEFAULT_BRAND_STATEMENT_DESCRIPTOR).toBe('SKINTWIN');
    expect(DEFAULT_BRAND_STATEMENT_DESCRIPTOR.length).toBeLessThanOrEqual(10);
    expect(DEFAULT_BRAND_URL).toBe('https://skintwin.ai');
    expect(DEFAULT_BRAND_SUPPORT_EMAIL).toBe('skintwin@stripe.com');
  });

  it('does not retain FurEver brand strings', () => {
    const brandSurface = [
      DEFAULT_BRAND_NAME,
      DEFAULT_BRAND_STATEMENT_DESCRIPTOR,
      DEFAULT_BRAND_SUPPORT_EMAIL,
      DEFAULT_BRAND_URL,
    ].join(' ');

    expect(brandSurface.toLowerCase()).not.toMatch(/furever|fur.?ever/);
  });

  it('uses human clinic client names for demo charges', () => {
    const names = DEMO_CUSTOMERS.map((customer) => customer.name);
    expect(names).toEqual([
      'Amara Okafor',
      'Liam Chen',
      'Sofia Reyes',
      'Noah Patel',
      'Ava Nguyen',
    ]);
    expect(names.join(' ').toLowerCase()).not.toMatch(
      /odie|snoopy|garfield|bugs bunny|\bdug\b/
    );
  });
});
