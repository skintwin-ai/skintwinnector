import {describe, expect, it} from 'vitest';
import type {Service} from '@/app/contexts/booking/types';
import {encodeSelectionMetadata} from '@/lib/bookingCheckout';
import {
  isPaidPaymentStatus,
  paymentReference,
  resolveConfirmationPhase,
  servicesFromMetadata,
  type RetrievedCheckout,
} from './bookingConfirmation';

const catalog = [
  {id: 'srv-001', name: 'Signature Facial'},
  {id: 'srv-010', name: 'Eye Treatment Add-On'},
] as Service[];

describe('bookingConfirmation helpers', () => {
  it('maps unresolved retrieve to pending and missing ids to empty or not-found', () => {
    expect(
      resolveConfirmationPhase({
        resolved: false,
        sessionId: 'cs_test_1',
        retrieved: null,
      })
    ).toBe('pending');
    expect(
      resolveConfirmationPhase({
        resolved: true,
        sessionId: null,
        retrieved: null,
      })
    ).toBe('empty');
    expect(
      resolveConfirmationPhase({
        resolved: true,
        sessionId: 'cs_test_1',
        retrieved: null,
      })
    ).toBe('not-found');
    expect(
      resolveConfirmationPhase({
        resolved: true,
        sessionId: 'cs_test_1',
        retrieved: null,
        retrieveFailed: true,
      })
    ).toBe('retrieve-error');
  });

  it('maps retrieve paid to a confirmed UI model with a Stripe reference', () => {
    const retrieved: RetrievedCheckout = {
      sessionId: 'cs_test_paid',
      paymentStatus: 'paid',
      amountTotal: 8500,
      currency: 'usd',
      paymentIntentId: 'pi_test_1',
      metadata: {},
    };
    expect(isPaidPaymentStatus(retrieved.paymentStatus)).toBe(true);
    expect(paymentReference(retrieved)).toBe('pi_test_1');
    expect(
      resolveConfirmationPhase({
        resolved: true,
        sessionId: retrieved.sessionId,
        retrieved,
      })
    ).toBe('paid');
  });

  it('maps retrieve unpaid to retry, never confirmed', () => {
    expect(
      resolveConfirmationPhase({
        resolved: true,
        sessionId: 'cs_test_unpaid',
        retrieved: {
          sessionId: 'cs_test_unpaid',
          paymentStatus: 'unpaid',
          amountTotal: 8500,
          currency: 'usd',
          paymentIntentId: null,
          metadata: {},
        },
      })
    ).toBe('unpaid');
    expect(isPaidPaymentStatus('unpaid')).toBe(false);
  });

  it('hydrates services from metadata after retrieve succeeds without a draft', () => {
    const selections = servicesFromMetadata(
      {
        selections: encodeSelectionMetadata([
          {serviceId: 'srv-001', quantity: 1, addOns: ['srv-010']},
        ]),
      },
      catalog
    );
    expect(selections.map((item) => item.serviceId)).toEqual(['srv-001']);
    expect(selections[0].service?.name).toBe('Signature Facial');
    expect(
      resolveConfirmationPhase({
        resolved: true,
        sessionId: 'cs_test_paid',
        retrieved: {
          sessionId: 'cs_test_paid',
          paymentStatus: 'paid',
          amountTotal: 8500,
          currency: 'usd',
          paymentIntentId: 'pi_test_1',
          metadata: {},
        },
      })
    ).toBe('paid');
  });
});
