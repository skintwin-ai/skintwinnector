import {beforeEach, describe, expect, it, vi} from 'vitest';
import {
  getClinicOverview,
  ingestPlatformRecord,
  listClinicBookings,
  listClinicClients,
  lookupClinicClient,
  markBookingPayment,
  persistCheckoutBooking,
  resetClinicRecordsForTests,
  upsertClinicClient,
} from './clinicRecords';

vi.mock('@/lib/dbConnect', () => ({
  default: vi.fn().mockRejectedValue(new Error('no mongo in unit tests')),
}));

const fetchMock = vi.fn();

describe('clinicRecords', () => {
  beforeEach(() => {
    resetClinicRecordsForTests();
    delete process.env.REGIMA_SUITE_URL;
    delete process.env.SKINTWIN_PLATFORM_KEY;
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('upserts and looks up a client by operator + email', async () => {
    await upsertClinicClient({
      operatorAccountId: 'acct_123',
      client: {
        firstName: 'Adaeze',
        lastName: 'Obi',
        email: 'Adaeze.Obi@example.com',
        phone: '+2348012345678',
        consentAccepted: true,
        intakeCompleted: true,
      },
    });

    const found = await lookupClinicClient(
      'acct_123',
      'adaeze.obi@example.com'
    );
    expect(found?.firstName).toBe('Adaeze');
    expect(found?.email).toBe('adaeze.obi@example.com');
    expect(
      await lookupClinicClient('acct_other', 'adaeze.obi@example.com')
    ).toBe(null);
  });

  it('persists a checkout booking onto the clinic schedule', async () => {
    await persistCheckoutBooking({
      operatorAccountId: 'acct_123',
      draftId: 'draft-1',
      checkoutSessionId: 'cs_test_1',
      paymentStatus: 'paid',
      amountTotal: 8500,
      currency: 'usd',
      services: [{serviceId: 'srv-001', quantity: 1, addOns: []}],
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
    });

    const bookings = await listClinicBookings({
      operatorAccountId: 'acct_123',
      date: '2026-09-22',
    });
    expect(bookings).toHaveLength(1);
    expect(bookings[0].paymentStatus).toBe('paid');
    expect(bookings[0].appointment?.providerId).toBe('prv-001');
    const clients = await listClinicClients('acct_123');
    expect(clients).toHaveLength(1);
    const overview = await getClinicOverview('acct_123');
    expect(overview.clientCount).toBe(1);
    expect(overview.monthToDateCents).toBe(8500);
  });

  it('ingests a salon-transformed appointment payload', async () => {
    const result = await ingestPlatformRecord({
      source: 'skintwin-salon',
      action: 'sync_appointment',
      data: {
        externalId: 'apt_99',
        date: '2026-09-22',
        scheduledAt: '14:00',
        duration: 60,
        status: 'confirmed_paid',
        provider: {externalId: 'prv-002'},
        services: [{externalId: 'srv-003'}],
        client: {
          profile: {
            firstName: 'Folake',
            lastName: 'Adeyemi',
            email: 'folake@example.com',
            phone: '+2348000000000',
          },
          consentStatus: {dataProcessing: true},
        },
      },
    });

    expect(result.ok).toBe(true);
    const bookings = await listClinicBookings({
      operatorAccountId: 'platform:skintwin-salon',
      date: '2026-09-22',
    });
    expect(bookings[0].paymentStatus).toBe('paid');
    expect(bookings[0].services[0].serviceId).toBe('srv-003');
  });

  async function seedUnpaidBooking() {
    await persistCheckoutBooking({
      operatorAccountId: 'acct_123',
      draftId: 'draft-1',
      checkoutSessionId: 'cs_test_1',
      paymentStatus: 'unpaid',
      amountTotal: 8500,
      currency: 'usd',
      services: [{serviceId: 'srv-001', quantity: 1, addOns: []}],
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
    });
  }

  it('posts a paid usd booking to suite with the provider name', async () => {
    process.env.REGIMA_SUITE_URL = 'http://suite.test';
    process.env.SKINTWIN_PLATFORM_KEY = 'mesh-secret';
    fetchMock.mockResolvedValue({ok: true});
    await seedUnpaidBooking();

    await markBookingPayment({
      checkoutSessionId: 'cs_test_1',
      operatorAccountId: 'acct_123',
      paymentStatus: 'paid',
      amountTotal: 8500,
      currency: 'usd',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://suite.test/api/trpc/platform.ingestPaidTreatment');
    expect(init.headers.authorization).toBe('Bearer mesh-secret');
    const body = JSON.parse(init.body);
    expect(body.json).toMatchObject({
      checkoutSessionId: 'cs_test_1',
      amountMinor: 8500,
      currency: 'usd',
      providerName: 'Amara Johnson',
      customerName: 'Adaeze Obi',
      source: 'skintwinnector',
    });
    expect(body.json.providerEmail).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('adaeze.obi@example.com');
  });

  it('posts again when the same booking is marked paid a second time', async () => {
    process.env.REGIMA_SUITE_URL = 'http://suite.test';
    process.env.SKINTWIN_PLATFORM_KEY = 'mesh-secret';
    fetchMock.mockResolvedValue({ok: true});
    await seedUnpaidBooking();
    const input = {
      checkoutSessionId: 'cs_test_1',
      operatorAccountId: 'acct_123',
      paymentStatus: 'paid',
      amountTotal: 8500,
      currency: 'usd',
    };
    await markBookingPayment(input);
    await markBookingPayment(input);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not post for unpaid, zero, other currencies, or a missing suite url', async () => {
    process.env.SKINTWIN_PLATFORM_KEY = 'mesh-secret';
    await seedUnpaidBooking();

    await markBookingPayment({
      checkoutSessionId: 'cs_test_1',
      operatorAccountId: 'acct_123',
      paymentStatus: 'unpaid',
      amountTotal: 8500,
      currency: 'usd',
    });

    process.env.REGIMA_SUITE_URL = 'http://suite.test';
    await markBookingPayment({
      checkoutSessionId: 'cs_test_1',
      operatorAccountId: 'acct_123',
      paymentStatus: 'paid',
      amountTotal: 0,
      currency: 'usd',
    });
    await markBookingPayment({
      checkoutSessionId: 'cs_test_1',
      operatorAccountId: 'acct_123',
      paymentStatus: 'paid',
      amountTotal: 8500,
      currency: 'eur',
    });
    delete process.env.REGIMA_SUITE_URL;
    await markBookingPayment({
      checkoutSessionId: 'cs_test_1',
      operatorAccountId: 'acct_123',
      paymentStatus: 'paid',
      amountTotal: 8500,
      currency: 'usd',
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the booking paid when the suite call throws', async () => {
    process.env.REGIMA_SUITE_URL = 'http://suite.test';
    process.env.SKINTWIN_PLATFORM_KEY = 'mesh-secret';
    fetchMock.mockRejectedValue(new Error('suite down'));
    await seedUnpaidBooking();

    await expect(
      markBookingPayment({
        checkoutSessionId: 'cs_test_1',
        operatorAccountId: 'acct_123',
        paymentStatus: 'paid',
        amountTotal: 8500,
        currency: 'usd',
      })
    ).resolves.toMatchObject({paymentStatus: 'paid'});

    const bookings = await listClinicBookings({operatorAccountId: 'acct_123'});
    expect(bookings[0].paymentStatus).toBe('paid');
  });

  it('does not post when a salon sync marks a booking paid without an amount', async () => {
    process.env.REGIMA_SUITE_URL = 'http://suite.test';
    process.env.SKINTWIN_PLATFORM_KEY = 'mesh-secret';

    await ingestPlatformRecord({
      source: 'skintwin-salon',
      action: 'sync_appointment',
      data: {
        externalId: 'apt_100',
        date: '2026-09-22',
        scheduledAt: '15:00',
        duration: 60,
        status: 'paid',
        provider: {externalId: 'prv-001'},
        services: [{externalId: 'srv-001'}],
        client: {
          profile: {
            firstName: 'Folake',
            lastName: 'Adeyemi',
            email: 'folake@example.com',
            phone: '+2348000000000',
          },
        },
      },
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
