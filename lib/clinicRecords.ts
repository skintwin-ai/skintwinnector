import type {
  Appointment,
  Client,
  ServiceSelection,
} from '@/app/contexts/booking/types';
import {canonicalEmail} from '@/lib/platformIdentity';

export type ClinicClientRecord = Client & {
  id: string;
  operatorAccountId: string;
  createdAt: string;
  updatedAt: string;
};

export type ClinicBookingRecord = {
  id: string;
  operatorAccountId: string;
  draftId: string;
  checkoutSessionId: string;
  paymentIntentId: string | null;
  paymentStatus: string;
  amountTotal: number | null;
  currency: string | null;
  displayTotal: number | null;
  source: string;
  services: ServiceSelection[];
  appointment: Appointment | null;
  client: Client | null;
  createdAt: string;
  updatedAt: string;
};

export type ClinicOverview = {
  monthToDateCents: number;
  monthToDateCurrency: string;
  paidBookingCount: number;
  clientCount: number;
  sparkline: number[];
};

type MemoryStore = {
  clients: Map<string, ClinicClientRecord>;
  bookings: Map<string, ClinicBookingRecord>;
};

const memory: MemoryStore = {
  clients: new Map(),
  bookings: new Map(),
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeEmail(email: string) {
  return canonicalEmail(email);
}

function clientKey(operatorAccountId: string, email: string) {
  return `${operatorAccountId}:${normalizeEmail(email)}`;
}

function bookingKey(checkoutSessionId: string) {
  return checkoutSessionId;
}

export function resetClinicRecordsForTests() {
  memory.clients.clear();
  memory.bookings.clear();
}

function addMinutes(time: string, minutes: number) {
  const [hours, mins] = time.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) {
    return '';
  }
  const total = hours * 60 + mins + minutes;
  const nextHours = Math.floor(total / 60) % 24;
  const nextMins = total % 60;
  return `${String(nextHours).padStart(2, '0')}:${String(nextMins).padStart(2, '0')}`;
}

function parseAppointment(raw: unknown): Appointment | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const value = raw as Record<string, unknown>;
  const date = typeof value.date === 'string' ? value.date : '';
  const startTime =
    typeof value.startTime === 'string'
      ? value.startTime
      : typeof value.scheduledAt === 'string'
        ? value.scheduledAt
        : '';
  const duration =
    typeof value.totalDurationMinutes === 'number'
      ? value.totalDurationMinutes
      : typeof value.duration === 'number'
        ? value.duration
        : 0;
  const endTime =
    typeof value.endTime === 'string' && value.endTime
      ? value.endTime
      : startTime && duration
        ? addMinutes(startTime, duration)
        : '';
  const providerId =
    typeof value.providerId === 'string'
      ? value.providerId
      : value.provider && typeof value.provider === 'object'
        ? String((value.provider as Record<string, unknown>).externalId || '')
        : '';
  if (!date || !startTime || !endTime || !providerId) {
    return null;
  }
  return {
    date,
    startTime,
    endTime,
    providerId,
    roomId: typeof value.roomId === 'string' ? value.roomId : undefined,
    totalDurationMinutes: duration,
  };
}

function parseClient(raw: unknown): Client | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const value = raw as Record<string, unknown>;
  if (typeof value.email !== 'string' || !value.email.trim()) {
    return null;
  }
  return {
    id: typeof value.id === 'string' ? value.id : undefined,
    firstName: typeof value.firstName === 'string' ? value.firstName : '',
    lastName: typeof value.lastName === 'string' ? value.lastName : '',
    email: normalizeEmail(value.email),
    phone: typeof value.phone === 'string' ? value.phone : '',
    consentAccepted: Boolean(value.consentAccepted),
    intakeCompleted: Boolean(value.intakeCompleted),
  };
}

function parseServices(raw: unknown): ServiceSelection[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter(
      (item) =>
        item &&
        typeof item === 'object' &&
        typeof (item as ServiceSelection).serviceId === 'string'
    )
    .map((item) => {
      const selection = item as ServiceSelection;
      return {
        serviceId: selection.serviceId,
        quantity: Number.isInteger(selection.quantity) ? selection.quantity : 1,
        addOns: Array.isArray(selection.addOns) ? selection.addOns : [],
      };
    });
}

async function tryMongo() {
  try {
    const {default: dbConnect} = await import('@/lib/dbConnect');
    await dbConnect();
    return true;
  } catch (error) {
    if (global.mongoose) {
      global.mongoose.promise = null;
      global.mongoose.conn = null;
    }
    console.warn('Clinic records using memory store', error);
    return false;
  }
}

export async function upsertClinicClient(input: {
  operatorAccountId: string;
  client: Client;
}): Promise<ClinicClientRecord> {
  const email = normalizeEmail(input.client.email);
  const key = clientKey(input.operatorAccountId, email);
  const existing = memory.clients.get(key);
  const record: ClinicClientRecord = {
    id: existing?.id || `cli_${Buffer.from(key).toString('hex').slice(0, 16)}`,
    operatorAccountId: input.operatorAccountId,
    firstName: input.client.firstName,
    lastName: input.client.lastName,
    email,
    phone: input.client.phone,
    consentAccepted: input.client.consentAccepted,
    intakeCompleted: input.client.intakeCompleted,
    createdAt: existing?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
  memory.clients.set(key, record);

  if (await tryMongo()) {
    const {default: ClinicClient} = await import('@/app/models/client');
    await ClinicClient.findOneAndUpdate(
      {operatorAccountId: input.operatorAccountId, email},
      record,
      {upsert: true, new: true, setDefaultsOnInsert: true}
    );
  }

  return record;
}

export async function lookupClinicClient(
  operatorAccountId: string,
  email: string
): Promise<ClinicClientRecord | null> {
  const normalized = normalizeEmail(email);
  if (await tryMongo()) {
    const {default: ClinicClient} = await import('@/app/models/client');
    const row = await ClinicClient.findOne({
      operatorAccountId,
      email: normalized,
    }).lean();
    if (row) {
      return row as ClinicClientRecord;
    }
  }
  return memory.clients.get(clientKey(operatorAccountId, normalized)) || null;
}

export async function listClinicClients(
  operatorAccountId: string
): Promise<ClinicClientRecord[]> {
  if (await tryMongo()) {
    const {default: ClinicClient} = await import('@/app/models/client');
    const rows = await ClinicClient.find({operatorAccountId})
      .sort({updatedAt: -1})
      .lean();
    if (rows.length) {
      return rows as ClinicClientRecord[];
    }
  }
  return Array.from(memory.clients.values())
    .filter((client) => client.operatorAccountId === operatorAccountId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function persistCheckoutBooking(input: {
  operatorAccountId: string;
  draftId: string;
  checkoutSessionId: string;
  paymentIntentId?: string | null;
  paymentStatus?: string;
  amountTotal?: number | null;
  currency?: string | null;
  displayTotal?: number | null;
  source?: string;
  services: ServiceSelection[];
  appointment?: unknown;
  client?: unknown;
}): Promise<ClinicBookingRecord> {
  const client = parseClient(input.client);
  if (client) {
    await upsertClinicClient({
      operatorAccountId: input.operatorAccountId,
      client,
    });
  }

  const key = bookingKey(input.checkoutSessionId);
  const existing = memory.bookings.get(key);
  const record: ClinicBookingRecord = {
    id: existing?.id || `bkg_${input.checkoutSessionId.slice(-16)}`,
    operatorAccountId: input.operatorAccountId,
    draftId: input.draftId,
    checkoutSessionId: input.checkoutSessionId,
    paymentIntentId: input.paymentIntentId || existing?.paymentIntentId || null,
    paymentStatus: input.paymentStatus || existing?.paymentStatus || 'unpaid',
    amountTotal:
      input.amountTotal === undefined
        ? existing?.amountTotal || null
        : input.amountTotal,
    currency:
      input.currency === undefined
        ? existing?.currency || null
        : input.currency,
    displayTotal:
      input.displayTotal === undefined
        ? existing?.displayTotal || null
        : input.displayTotal,
    source: input.source || existing?.source || 'skintwinnector',
    services: input.services.length ? input.services : existing?.services || [],
    appointment:
      parseAppointment(input.appointment) || existing?.appointment || null,
    client: client || existing?.client || null,
    createdAt: existing?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
  memory.bookings.set(key, record);

  if (await tryMongo()) {
    const {default: ClinicBooking} = await import('@/app/models/booking');
    await ClinicBooking.findOneAndUpdate(
      {checkoutSessionId: input.checkoutSessionId},
      record,
      {upsert: true, new: true, setDefaultsOnInsert: true}
    );
  }

  return record;
}

export async function markBookingPayment(input: {
  checkoutSessionId: string;
  operatorAccountId: string;
  paymentStatus: string;
  paymentIntentId?: string | null;
  amountTotal?: number | null;
  currency?: string | null;
}): Promise<ClinicBookingRecord | null> {
  const existing =
    memory.bookings.get(bookingKey(input.checkoutSessionId)) ||
    Array.from(memory.bookings.values()).find(
      (booking) =>
        booking.operatorAccountId === input.operatorAccountId &&
        booking.checkoutSessionId === input.checkoutSessionId
    );
  if (!existing) {
    if (await tryMongo()) {
      const {default: ClinicBooking} = await import('@/app/models/booking');
      const row = await ClinicBooking.findOneAndUpdate(
        {
          checkoutSessionId: input.checkoutSessionId,
          operatorAccountId: input.operatorAccountId,
        },
        {
          paymentStatus: input.paymentStatus,
          paymentIntentId: input.paymentIntentId || undefined,
          amountTotal: input.amountTotal ?? undefined,
          currency: input.currency ?? undefined,
          updatedAt: nowIso(),
        },
        {new: true}
      ).lean();
      return (row as ClinicBookingRecord) || null;
    }
    return null;
  }

  return persistCheckoutBooking({
    ...existing,
    paymentStatus: input.paymentStatus,
    paymentIntentId: input.paymentIntentId,
    amountTotal: input.amountTotal,
    currency: input.currency,
    services: existing.services,
    appointment: existing.appointment,
    client: existing.client,
  });
}

export async function listClinicBookings(input: {
  operatorAccountId: string;
  date?: string;
}): Promise<ClinicBookingRecord[]> {
  const filterDate = input.date;
  if (await tryMongo()) {
    const {default: ClinicBooking} = await import('@/app/models/booking');
    const query: Record<string, unknown> = {
      operatorAccountId: input.operatorAccountId,
    };
    if (filterDate) {
      query['appointment.date'] = filterDate;
    }
    const rows = await ClinicBooking.find(query)
      .sort({'appointment.startTime': 1, updatedAt: -1})
      .lean();
    if (rows.length) {
      return rows as ClinicBookingRecord[];
    }
  }

  return Array.from(memory.bookings.values())
    .filter((booking) => booking.operatorAccountId === input.operatorAccountId)
    .filter((booking) =>
      filterDate ? booking.appointment?.date === filterDate : true
    )
    .sort((a, b) => {
      const aTime = a.appointment?.startTime || '';
      const bTime = b.appointment?.startTime || '';
      return aTime.localeCompare(bTime);
    });
}

export async function getClinicOverview(
  operatorAccountId: string
): Promise<ClinicOverview> {
  const [clients, bookings] = await Promise.all([
    listClinicClients(operatorAccountId),
    listClinicBookings({operatorAccountId}),
  ]);
  const month = new Date().toISOString().slice(0, 7);
  const paidThisMonth = bookings.filter(
    (booking) =>
      booking.paymentStatus === 'paid' && booking.updatedAt.startsWith(month)
  );
  const monthToDateCents = paidThisMonth.reduce(
    (sum, booking) => sum + (booking.amountTotal || 0),
    0
  );
  const sparkline = Array.from({length: 12}, (_, index) => {
    const count = paidThisMonth.filter((booking) => {
      const day = Number(booking.updatedAt.slice(8, 10));
      return day % 12 === index;
    }).length;
    return count;
  });

  return {
    monthToDateCents,
    monthToDateCurrency: paidThisMonth[0]?.currency || 'usd',
    paidBookingCount: paidThisMonth.length,
    clientCount: clients.length,
    sparkline,
  };
}

function clientFromPlatform(raw: unknown): Client | null {
  const direct = parseClient(raw);
  if (direct) {
    return direct;
  }
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const value = raw as Record<string, unknown>;
  const profile =
    value.profile && typeof value.profile === 'object'
      ? (value.profile as Record<string, unknown>)
      : value;
  const consent =
    value.consentStatus && typeof value.consentStatus === 'object'
      ? (value.consentStatus as Record<string, unknown>)
      : {};
  return parseClient({
    id: value.externalId || value.id,
    firstName: profile.firstName,
    lastName: profile.lastName,
    email: profile.email,
    phone: profile.phone,
    consentAccepted: consent.dataProcessing ?? value.consentAccepted,
    intakeCompleted: true,
  });
}

function appointmentFromPlatform(raw: unknown): {
  id: string;
  services: ServiceSelection[];
  appointment: Appointment | null;
  client: Client | null;
  status: string;
} | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const value = raw as Record<string, unknown>;
  const id =
    (typeof value.id === 'string' && value.id) ||
    (typeof value.externalId === 'string' && value.externalId) ||
    '';
  if (!id) {
    return null;
  }
  const provider =
    value.provider && typeof value.provider === 'object'
      ? (value.provider as Record<string, unknown>)
      : {};
  const services = Array.isArray(value.services)
    ? value.services.map((item) => {
        const service = item as Record<string, unknown>;
        return {
          serviceId: String(
            service.serviceId || service.externalId || service.id || ''
          ),
          quantity: 1,
          addOns: [],
        };
      })
    : parseServices(value.services);
  const startTime =
    typeof value.startTime === 'string'
      ? value.startTime
      : typeof value.scheduledAt === 'string'
        ? value.scheduledAt
        : '';
  return {
    id,
    services,
    appointment: parseAppointment({
      date: value.date,
      startTime,
      endTime: value.endTime,
      providerId: value.providerId || provider.externalId,
      roomId:
        value.roomId ||
        (value.metadata && typeof value.metadata === 'object'
          ? (value.metadata as Record<string, unknown>).roomId
          : undefined),
      totalDurationMinutes: value.totalDurationMinutes || value.duration,
    }),
    client: clientFromPlatform(value.client),
    status: typeof value.status === 'string' ? value.status : 'unpaid',
  };
}

function paidLikeStatus(status: string) {
  return status === 'paid' || status === 'confirmed_paid';
}

export async function ingestPlatformRecord(input: {
  source: string;
  action: 'sync_appointment' | 'sync_client' | 'sync_certification';
  operatorAccountId?: string;
  appointment?: unknown;
  client?: unknown;
  data?: unknown;
  certification?: {
    therapistEmail?: string;
    therapistName?: string;
    certLevel?: string;
    courseId?: string;
  };
}) {
  const operatorAccountId =
    input.operatorAccountId || `platform:${input.source}`;
  const client = clientFromPlatform(input.client || input.data);
  if ((input.action === 'sync_client' || input.client) && client) {
    const record = await upsertClinicClient({operatorAccountId, client});
    return {
      ok: true,
      source: input.source,
      action: input.action,
      id: record.id,
    };
  }
  if (input.action === 'sync_appointment') {
    const appointment = appointmentFromPlatform(
      input.appointment || input.data
    );
    if (!appointment) {
      throw new Error('Appointment id is required');
    }
    const record = await persistCheckoutBooking({
      operatorAccountId,
      draftId: appointment.id,
      checkoutSessionId: `cs_platform_${appointment.id}`,
      paymentStatus: paidLikeStatus(appointment.status)
        ? 'paid'
        : appointment.status || 'unpaid',
      source: input.source,
      services: appointment.services,
      appointment: appointment.appointment,
      client: appointment.client || client,
    });
    return {
      ok: true,
      source: input.source,
      action: input.action,
      id: record.id,
      skintwinId: record.id,
    };
  }
  if (input.action === 'sync_certification' && input.certification) {
    const email =
      input.certification.therapistEmail ||
      `${(input.certification.therapistName || 'therapist')
        .toLowerCase()
        .replace(/\s+/g, '.')}@skintwin.ai`;
    const record = await upsertClinicClient({
      operatorAccountId,
      client: {
        firstName:
          input.certification.therapistName?.split(' ')[0] || 'Therapist',
        lastName:
          input.certification.therapistName?.split(' ').slice(1).join(' ') ||
          'Certified',
        email,
        phone: '',
        consentAccepted: true,
        intakeCompleted: true,
        id: input.certification.courseId,
      },
    });
    return {
      ok: true,
      source: input.source,
      action: input.action,
      id: record.id,
    };
  }
  return {ok: true, source: input.source, action: input.action};
}

export {parseAppointment, parseClient, parseServices};
