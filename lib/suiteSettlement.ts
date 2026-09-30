import providersData from '@/app/data/providers.json';
import type {ClinicBookingRecord} from '@/lib/clinicRecords';

type ProviderRecord = {
  id: string;
  name: string;
  email?: string;
};

const providers = providersData as ProviderRecord[];

export function canRecordPaidTreatment(record: ClinicBookingRecord) {
  const currency = record.currency?.trim().toLowerCase();
  return (
    record.paymentStatus === 'paid' &&
    typeof record.amountTotal === 'number' &&
    Number.isInteger(record.amountTotal) &&
    record.amountTotal > 0 &&
    (currency === 'usd' || currency === 'ngn')
  );
}

export function paidTreatmentBody(record: ClinicBookingRecord) {
  const provider = providers.find(
    (item) => item.id === record.appointment?.providerId
  );
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
  if (provider?.email) {
    payload.providerEmail = provider.email;
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
