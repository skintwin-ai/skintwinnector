import {describe, expect, it} from 'vitest';
import {buildWizardCheckoutBody} from './bookingWizard';

const catalog = [
  {
    id: 'srv-001',
    name: 'Signature Facial',
    price: 8500,
    usdChargeCents: 8500,
    addOns: [],
  },
];

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

describe('booking wizard', () => {
  it('builds the same payload the intake page posts to checkout', () => {
    expect(
      buildWizardCheckoutBody({
        draftId: 'draft-wizard-1',
        catalog,
        services: [{serviceId: 'srv-001', quantity: 1, addOns: []}],
        appointment,
        client,
      })
    ).toMatchObject({
      draftId: 'draft-wizard-1',
      services: [{serviceId: 'srv-001', quantity: 1, addOns: []}],
    });
  });

  it('rejects an unknown catalog service', () => {
    expect(() =>
      buildWizardCheckoutBody({
        draftId: 'draft-wizard-1',
        catalog,
        services: [{serviceId: 'missing', quantity: 1, addOns: []}],
        appointment,
        client,
      })
    ).toThrow(/Unknown service/);
  });
});
