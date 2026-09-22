import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {
  deleteBookingDraft,
  loadBookingDraft,
  persistBookingDraft,
  type BookingDraft,
} from './bookingDraft';

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

const draft: BookingDraft = {
  draftId: 'draft-1',
  sessionId: 'cs_test_1',
  retryAttempt: 1,
  services: [{serviceId: 'srv-001', quantity: 1, addOns: ['srv-010']}],
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
    consentAccepted: true,
    intakeCompleted: true,
  },
};

describe('bookingDraft', () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  afterEach(() => {
    deleteBookingDraft('cs_test_1');
    deleteBookingDraft('cs_test_2');
  });

  it('round-trips a snapshot by session id', () => {
    persistBookingDraft('cs_test_1', draft);
    expect(loadBookingDraft('cs_test_1')).toEqual(draft);
  });

  it('overwrites the previous draft for the same key', () => {
    persistBookingDraft('cs_test_1', draft);
    persistBookingDraft('cs_test_1', {...draft, retryAttempt: 2});
    expect(loadBookingDraft('cs_test_1')?.retryAttempt).toBe(2);
  });

  it('returns null without throwing when sessionStorage is missing', () => {
    const previousWindow = globalThis.window;
    // @ts-expect-error -- simulate a storage-less environment
    delete globalThis.window;
    expect(loadBookingDraft('cs_test_1')).toBeNull();
    expect(() => persistBookingDraft('cs_test_1', draft)).not.toThrow();
    globalThis.window = previousWindow;
  });
});
