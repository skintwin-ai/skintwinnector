import {readFileSync} from 'node:fs';
import {describe, expect, it, vi} from 'vitest';
import {startMarketplaceCheckout} from './startMarketplaceCheckout';

describe('startMarketplaceCheckout', () => {
  it('posts the slug, service id, and quantity', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_market_1',
        orderId: 'ord_1',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await startMarketplaceCheckout({
      slug: 'ada',
      serviceId: 'srv-live',
      quantity: 2,
    });

    expect(result.checkoutUrl).toContain('cs_market_1');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/marketplace/checkout',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          slug: 'ada',
          services: [{serviceId: 'srv-live', quantity: 2}],
        }),
      })
    );
    const source = readFileSync(
      new URL('./startMarketplaceCheckout.ts', import.meta.url),
      'utf8'
    );
    expect(source).not.toContain('loadBookingDraft');
    expect(source).not.toContain('persistBookingDraft');
  });
});
