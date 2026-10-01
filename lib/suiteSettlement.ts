import providersData from '@/app/data/providers.json';
import {isSupportedChargeCurrency} from '@/lib/bookingCheckout';
import {isPaidPaymentStatus} from '@/lib/bookingConfirmation';
import type {ClinicBookingRecord} from '@/lib/clinicRecords';
import {providerClinicEmail} from '@/lib/providerRoster';

type ProviderRecord = {
  id: string;
  name: string;
};

const providers = providersData as ProviderRecord[];

const SUITE_NOTIFY_TIMEOUT_MS = 5_000;

function canRecordPaidTreatment(record: ClinicBookingRecord) {
  const currency = record.currency?.trim().toLowerCase();
  return (
    isPaidPaymentStatus(record.paymentStatus) &&
    typeof record.amountTotal === 'number' &&
    Number.isInteger(record.amountTotal) &&
    record.amountTotal > 0 &&
    isSupportedChargeCurrency(currency)
  );
}

function paidTreatmentBody(record: ClinicBookingRecord) {
  const providerId = record.appointment?.providerId;
  const provider = providers.find((item) => item.id === providerId);
  const providerEmail = providerClinicEmail(providerId);
  const customerName = [record.client?.firstName, record.client?.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  const payload: {
    checkoutSessionId: string;
    amountMinor: number;
    currency: string;
    providerName: string;
    providerEmail?: string;
    customerName: string;
    source: string;
  } = {
    checkoutSessionId: record.checkoutSessionId,
    amountMinor: record.amountTotal ?? 0,
    currency: record.currency ?? '',
    providerName: provider?.name ?? '',
    customerName,
    source: record.source,
  };
  if (providerEmail) {
    payload.providerEmail = providerEmail;
  }
  return {json: payload};
}

export async function notifyPaidTreatment(record: ClinicBookingRecord) {
  const suiteUrl = process.env.REGIMA_SUITE_URL;
  const platformKey = process.env.SKINTWIN_PLATFORM_KEY;
  if (!canRecordPaidTreatment(record) || !suiteUrl || !platformKey) {
    return;
  }

  const url = `${suiteUrl.replace(/\/$/, '')}/api/trpc/platform.ingestPaidTreatment`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${platformKey}`,
      },
      body: JSON.stringify(paidTreatmentBody(record)),
      signal: AbortSignal.timeout(SUITE_NOTIFY_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error(
        '[suite settlement] paid treatment notify failed',
        response.status
      );
    }
  } catch (error) {
    console.error('[suite settlement] paid treatment notify failed', error);
  }
}
