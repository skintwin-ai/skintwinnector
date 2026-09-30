import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {ClinicBookingRecord} from './clinicRecords';
import {notifyPaidTreatment} from './suiteSettlement';

const fetchMock = vi.fn();

function paidRecord(): ClinicBookingRecord {
  return {
    id: 'bkg_1',
    operatorAccountId: 'acct_123',
    draftId: 'draft-1',
    checkoutSessionId: 'cs_test_1',
    paymentIntentId: null,
    paymentStatus: 'paid',
    amountTotal: 8500,
    currency: 'usd',
    displayTotal: 85,
    source: 'skintwinnector',
    services: [],
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
    createdAt: '2026-09-22T10:00:00.000Z',
    updatedAt: '2026-09-22T10:00:00.000Z',
  };
}

describe('notifyPaidTreatment', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    process.env.REGIMA_SUITE_URL = 'http://suite.test/';
    process.env.SKINTWIN_PLATFORM_KEY = 'mesh-secret';
  });

  it('posts the checkout session when the charge can be recorded', async () => {
    fetchMock.mockResolvedValue({ok: true});
    await notifyPaidTreatment(paidRecord());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://suite.test/api/trpc/platform.ingestPaidTreatment');
    expect(init.method).toBe('POST');
    expect(init.headers.authorization).toBe('Bearer mesh-secret');
    expect(JSON.parse(init.body).json.checkoutSessionId).toBe('cs_test_1');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('skips the call when the platform key is unset', async () => {
    delete process.env.SKINTWIN_PLATFORM_KEY;
    await notifyPaidTreatment(paidRecord());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('resolves when fetch throws', async () => {
    fetchMock.mockRejectedValue(new Error('suite down'));
    await expect(notifyPaidTreatment(paidRecord())).resolves.toBeUndefined();
  });

  it('resolves when the suite call aborts', async () => {
    fetchMock.mockRejectedValue(
      new DOMException('The operation was aborted', 'AbortError')
    );
    await expect(notifyPaidTreatment(paidRecord())).resolves.toBeUndefined();
  });
});
