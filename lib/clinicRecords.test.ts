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

const dbConnectMock = vi.hoisted(() =>
  vi.fn().mockRejectedValue(new Error('no mongo in unit tests'))
);
const findOneAndUpdateMock = vi.hoisted(() => vi.fn());
const findOneMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/dbConnect', () => ({
  default: dbConnectMock,
}));

vi.mock('@/app/models/booking', () => ({
  default: {
    findOneAndUpdate: findOneAndUpdateMock,
    findOne: findOneMock,
    find: () => ({
      sort: () => ({
        lean: async () => [],
      }),
    }),
  },
}));

const fetchMock = vi.fn();

describe('clinicRecords', () => {
  beforeEach(() => {
    resetClinicRecordsForTests();
    delete process.env.REGIMA_SUITE_URL;
    delete process.env.SKINTWIN_PLATFORM_KEY;
    fetchMock.mockReset();
    dbConnectMock.mockReset();
    dbConnectMock.mockRejectedValue(new Error('no mongo in unit tests'));
    findOneAndUpdateMock.mockReset();
    findOneMock.mockReset();
    findOneMock.mockReturnValue({lean: async () => null});
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

  async function seedUnpaidBooking(providerId = 'prv-001') {
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
        providerId,
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
    expect(body.json.providerEmail).toBe('amara.johnson@clinic.skintwin.ai');
    expect(JSON.stringify(body)).not.toContain('adaeze.obi@example.com');
    expect(body.json).not.toHaveProperty('providerId');
  });

  it('posts Ngozi Eze email for prv-004', async () => {
    process.env.REGIMA_SUITE_URL = 'http://suite.test';
    process.env.SKINTWIN_PLATFORM_KEY = 'mesh-secret';
    fetchMock.mockResolvedValue({ok: true});
    await seedUnpaidBooking('prv-004');

    await markBookingPayment({
      checkoutSessionId: 'cs_test_1',
      operatorAccountId: 'acct_123',
      paymentStatus: 'paid',
      amountTotal: 8500,
      currency: 'usd',
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.json.providerEmail).toBe('ngozi.eze@clinic.skintwin.ai');
    expect(body.json.providerName).toBe('Ngozi Eze');
  });

  it('omits providerEmail when the provider is not in the catalog', async () => {
    process.env.REGIMA_SUITE_URL = 'http://suite.test';
    process.env.SKINTWIN_PLATFORM_KEY = 'mesh-secret';
    fetchMock.mockResolvedValue({ok: true});
    await seedUnpaidBooking('prv-missing');

    await markBookingPayment({
      checkoutSessionId: 'cs_test_1',
      operatorAccountId: 'acct_123',
      paymentStatus: 'paid',
      amountTotal: 8500,
      currency: 'usd',
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.json.providerName).toBe('');
    expect(body.json.providerEmail).toBeUndefined();
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

  it('does not post for unpaid, zero, other currencies, non-integer, or a missing suite url', async () => {
    process.env.REGIMA_SUITE_URL = 'http://suite.test';
    process.env.SKINTWIN_PLATFORM_KEY = 'mesh-secret';
    await seedUnpaidBooking();

    await markBookingPayment({
      checkoutSessionId: 'cs_test_1',
      operatorAccountId: 'acct_123',
      paymentStatus: 'unpaid',
      amountTotal: 8500,
      currency: 'usd',
    });
    expect(fetchMock).not.toHaveBeenCalled();

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
    await markBookingPayment({
      checkoutSessionId: 'cs_test_1',
      operatorAccountId: 'acct_123',
      paymentStatus: 'paid',
      amountTotal: 85.5,
      currency: 'usd',
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

  function salonAppointment(overrides: Record<string, unknown> = {}) {
    return {
      date: '2026-09-22',
      scheduledAt: '16:00',
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
      ...overrides,
    };
  }

  it('posts catalog usd cents for a paid salon srv-001 sync', async () => {
    process.env.REGIMA_SUITE_URL = 'http://suite.test';
    process.env.SKINTWIN_PLATFORM_KEY = 'mesh-secret';
    fetchMock.mockResolvedValue({ok: true});

    await ingestPlatformRecord({
      source: 'skintwin-salon',
      action: 'sync_appointment',
      data: salonAppointment({
        externalId: 'apt_200',
        currency: 'usd',
      }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body).json;
    expect(body).toMatchObject({
      checkoutSessionId: 'cs_platform_apt_200',
      amountMinor: 8500,
      currency: 'usd',
      providerName: 'Amara Johnson',
      providerEmail: 'amara.johnson@clinic.skintwin.ai',
    });
    expect(JSON.stringify(body)).not.toContain('folake@example.com');

    fetchMock.mockClear();
    await ingestPlatformRecord({
      source: 'skintwin-salon',
      action: 'sync_appointment',
      data: salonAppointment({
        externalId: 'apt_200',
        currency: 'usd',
      }),
    });
    expect(
      JSON.parse(fetchMock.mock.calls[0][1].body).json.checkoutSessionId
    ).toBe('cs_platform_apt_200');
  });

  it('posts catalog ngn kobo when a paid salon sync omits currency', async () => {
    process.env.REGIMA_SUITE_URL = 'http://suite.test';
    process.env.SKINTWIN_PLATFORM_KEY = 'mesh-secret';
    fetchMock.mockResolvedValue({ok: true});

    await ingestPlatformRecord({
      source: 'skintwin-salon',
      action: 'sync_appointment',
      data: salonAppointment({externalId: 'apt_201'}),
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body).json;
    expect(body.amountMinor).toBe(850000);
    expect(body.currency).toBe('ngn');
  });

  it('scales a payload ngn amount and prefers a usd payload over catalog', async () => {
    process.env.REGIMA_SUITE_URL = 'http://suite.test';
    process.env.SKINTWIN_PLATFORM_KEY = 'mesh-secret';
    fetchMock.mockResolvedValue({ok: true});

    await ingestPlatformRecord({
      source: 'skintwin-salon',
      action: 'sync_appointment',
      data: salonAppointment({
        externalId: 'apt_202',
        amountTotal: 8500,
        currency: 'ngn',
      }),
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).json.amountMinor).toBe(
      850000
    );

    fetchMock.mockClear();
    await ingestPlatformRecord({
      source: 'skintwin-salon',
      action: 'sync_appointment',
      data: salonAppointment({
        externalId: 'apt_203',
        amountTotal: 1,
        currency: 'usd',
      }),
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).json.amountMinor).toBe(
      1
    );
  });

  it('does not post an unpriced or draft salon sync', async () => {
    process.env.REGIMA_SUITE_URL = 'http://suite.test';
    process.env.SKINTWIN_PLATFORM_KEY = 'mesh-secret';

    await ingestPlatformRecord({
      source: 'skintwin-salon',
      action: 'sync_appointment',
      data: salonAppointment({
        externalId: 'apt_204',
        services: [],
      }),
    });
    await ingestPlatformRecord({
      source: 'skintwin-salon',
      action: 'sync_appointment',
      data: salonAppointment({
        externalId: 'apt_205',
        services: [{externalId: 'srv-missing'}],
      }),
    });
    await ingestPlatformRecord({
      source: 'skintwin-salon',
      action: 'sync_appointment',
      data: salonAppointment({
        externalId: 'apt_206',
        status: 'draft',
      }),
    });

    expect(fetchMock).not.toHaveBeenCalled();
    const bookings = await listClinicBookings({
      operatorAccountId: 'platform:skintwin-salon',
    });
    expect(bookings.map((booking) => booking.draftId).sort()).toEqual([
      'apt_204',
      'apt_205',
      'apt_206',
    ]);
  });

  it('posts an empty provider name when the provider is unknown', async () => {
    process.env.REGIMA_SUITE_URL = 'http://suite.test';
    process.env.SKINTWIN_PLATFORM_KEY = 'mesh-secret';
    fetchMock.mockResolvedValue({ok: true});

    await ingestPlatformRecord({
      source: 'skintwin-salon',
      action: 'sync_appointment',
      data: salonAppointment({
        externalId: 'apt_207',
        currency: 'usd',
        provider: {externalId: 'prv-unknown'},
      }),
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body).json;
    expect(body.providerName).toBe('');
    expect(body.providerEmail).toBeUndefined();
  });

  it('keeps a paid salon booking paid when suite is down and on later completed sync', async () => {
    delete process.env.REGIMA_SUITE_URL;
    process.env.SKINTWIN_PLATFORM_KEY = 'mesh-secret';

    await ingestPlatformRecord({
      source: 'skintwin-salon',
      action: 'sync_appointment',
      data: salonAppointment({
        externalId: 'apt_208',
        currency: 'usd',
      }),
    });

    let bookings = await listClinicBookings({
      operatorAccountId: 'platform:skintwin-salon',
    });
    expect(bookings[0].paymentStatus).toBe('paid');
    expect(fetchMock).not.toHaveBeenCalled();

    process.env.REGIMA_SUITE_URL = 'http://suite.test';
    fetchMock.mockRejectedValue(new Error('suite down'));

    await ingestPlatformRecord({
      source: 'skintwin-salon',
      action: 'sync_appointment',
      data: salonAppointment({
        externalId: 'apt_208',
        currency: 'usd',
      }),
    });

    bookings = await listClinicBookings({
      operatorAccountId: 'platform:skintwin-salon',
    });
    expect(bookings[0].paymentStatus).toBe('paid');

    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ok: true});
    await ingestPlatformRecord({
      source: 'skintwin-salon',
      action: 'sync_appointment',
      data: salonAppointment({
        externalId: 'apt_208',
        currency: 'usd',
        status: 'completed',
      }),
    });

    bookings = await listClinicBookings({
      operatorAccountId: 'platform:skintwin-salon',
    });
    expect(bookings[0].paymentStatus).toBe('paid');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      JSON.parse(fetchMock.mock.calls[0][1].body).json.checkoutSessionId
    ).toBe('cs_platform_apt_208');
  });

  it('keeps a mongo-backed paid booking paid on later completed sync', async () => {
    process.env.REGIMA_SUITE_URL = 'http://suite.test';
    process.env.SKINTWIN_PLATFORM_KEY = 'mesh-secret';
    fetchMock.mockResolvedValue({ok: true});
    dbConnectMock.mockResolvedValue({});
    findOneMock.mockReturnValue({
      lean: async () => ({
        id: 'bkg_apt_209',
        operatorAccountId: 'platform:skintwin-salon',
        draftId: 'apt_209',
        checkoutSessionId: 'cs_platform_apt_209',
        paymentIntentId: null,
        paymentStatus: 'paid',
        amountTotal: 8500,
        currency: 'usd',
        displayTotal: null,
        source: 'skintwin-salon',
        services: [{serviceId: 'srv-001', quantity: 1, addOns: []}],
        appointment: {
          date: '2026-09-22',
          startTime: '16:00',
          endTime: '17:00',
          providerId: 'prv-001',
          totalDurationMinutes: 60,
        },
        client: null,
        createdAt: '2026-09-22T16:00:00.000Z',
        updatedAt: '2026-09-22T16:05:00.000Z',
      }),
    });

    await ingestPlatformRecord({
      source: 'skintwin-salon',
      action: 'sync_appointment',
      data: salonAppointment({
        externalId: 'apt_209',
        currency: 'usd',
        status: 'completed',
        client: undefined,
      }),
    });

    dbConnectMock.mockRejectedValue(new Error('no mongo in unit tests'));
    const bookings = await listClinicBookings({
      operatorAccountId: 'platform:skintwin-salon',
    });
    expect(bookings[0].paymentStatus).toBe('paid');
    expect(bookings[0].amountTotal).toBe(8500);
    expect(bookings[0].currency).toBe('usd');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      JSON.parse(fetchMock.mock.calls[0][1].body).json.checkoutSessionId
    ).toBe('cs_platform_apt_209');
  });

  it('returns null without fetch when the checkout session is missing', async () => {
    process.env.REGIMA_SUITE_URL = 'http://suite.test';
    process.env.SKINTWIN_PLATFORM_KEY = 'mesh-secret';

    await expect(
      markBookingPayment({
        checkoutSessionId: 'cs_missing',
        operatorAccountId: 'acct_123',
        paymentStatus: 'paid',
        amountTotal: 8500,
        currency: 'usd',
      })
    ).resolves.toBeNull();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts to suite when mongo returns the paid booking row', async () => {
    process.env.REGIMA_SUITE_URL = 'http://suite.test';
    process.env.SKINTWIN_PLATFORM_KEY = 'mesh-secret';
    fetchMock.mockResolvedValue({ok: true});
    dbConnectMock.mockResolvedValue({});
    findOneAndUpdateMock.mockReturnValue({
      lean: async () => ({
        id: 'bkg_mongo_1',
        operatorAccountId: 'acct_123',
        draftId: 'draft-mongo',
        checkoutSessionId: 'cs_mongo_1',
        paymentIntentId: null,
        paymentStatus: 'paid',
        amountTotal: 8500,
        currency: 'usd',
        displayTotal: 85,
        source: 'skintwinnector',
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
        createdAt: '2026-09-22T10:00:00.000Z',
        updatedAt: '2026-09-22T10:05:00.000Z',
      }),
    });

    const record = await markBookingPayment({
      checkoutSessionId: 'cs_mongo_1',
      operatorAccountId: 'acct_123',
      paymentStatus: 'paid',
      amountTotal: 8500,
      currency: 'usd',
    });

    expect(record?.paymentStatus).toBe('paid');
    expect(findOneAndUpdateMock).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.json.checkoutSessionId).toBe('cs_mongo_1');
    expect(body.json.amountMinor).toBe(8500);
  });
});
