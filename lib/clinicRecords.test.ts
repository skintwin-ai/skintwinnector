import {beforeEach, describe, expect, it, vi} from 'vitest';
import {
  getClinicOverview,
  ingestPlatformRecord,
  listClinicBookings,
  listClinicClients,
  lookupClinicClient,
  persistCheckoutBooking,
  resetClinicRecordsForTests,
  upsertClinicClient,
} from './clinicRecords';

vi.mock('@/lib/dbConnect', () => ({
  default: vi.fn().mockRejectedValue(new Error('no mongo in unit tests')),
}));

describe('clinicRecords', () => {
  beforeEach(() => {
    resetClinicRecordsForTests();
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
});
