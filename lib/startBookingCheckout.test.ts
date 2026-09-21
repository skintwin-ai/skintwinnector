import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {loadBookingDraft} from './bookingDraft';
import {startBookingCheckout} from './startBookingCheckout';

const appointment = {
  date: '2026-09-22',
  startTime: '10:00',
  endTime: '11:15',
  providerId: 'prv-001',
  totalDurationMinutes: 75,
};
const client = {
  firstName: 'Adaeze',
  lastName: 'Obi',
  email: 'adaeze.obi@example.com',
  phone: '+2348012345678',
  consentAccepted: true,
  intakeCompleted: true,
};

function installMemoryStorage() {
  const data = new Map<string, string>();
  const memoryStorage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  } as Storage;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {sessionStorage: memoryStorage},
  });
}

describe('startBookingCheckout', () => {
  beforeEach(() => {
    installMemoryStorage();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_new',
          sessionId: 'cs_new',
        }),
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('persists the new draft and removes the previous session key on retry', async () => {
    window.sessionStorage.setItem(
      'skintwin.bookingDraft.cs_old',
      JSON.stringify({draftId: 'draft-1'})
    );

    const result = await startBookingCheckout({
      draftId: 'draft-1',
      retryAttempt: 2,
      services: [{serviceId: 'srv-001', quantity: 1, addOns: []}],
      appointment,
      client,
      replaceSessionId: 'cs_old',
    });

    expect(result.sessionId).toBe('cs_new');
    expect(loadBookingDraft('cs_new')?.retryAttempt).toBe(2);
    expect(loadBookingDraft('cs_old')).toBeNull();
  });

  it('throws without persisting when create checkout fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({error: 'Unable to start checkout'}),
      })
    );
    await expect(
      startBookingCheckout({
        draftId: 'draft-1',
        services: [{serviceId: 'srv-001', quantity: 1, addOns: []}],
        appointment,
        client,
      })
    ).rejects.toThrow('Unable to start checkout');
    expect(loadBookingDraft('cs_new')).toBeNull();
  });
});
