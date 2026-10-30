import servicesData from '@/app/data/services.json';
import type {Service} from '@/app/contexts/booking/types';

export type CatalogMode = 'treatment' | 'storefront';

export class CatalogMirrorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogMirrorError';
  }
}

export type ProvisionedServiceRecord = Service & {
  operatorAccountId: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
};

type MemoryStore = {
  services: Map<string, ProvisionedServiceRecord>;
};

const memory: MemoryStore = {
  services: new Map(),
};

const slugOwners = new Map<string, string>();
const accountSlugs = new Map<string, string>();

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const sharedServices = servicesData as Service[];

function nowIso() {
  return new Date().toISOString();
}

function serviceKey(operatorAccountId: string, serviceId: string) {
  return `${operatorAccountId}:${serviceId}`;
}

export function resetServiceCatalogForTests() {
  memory.services.clear();
  slugOwners.clear();
  accountSlugs.clear();
}

export function slugForAccount(operatorAccountId: string) {
  return accountSlugs.get(operatorAccountId) || null;
}

export function claimSalonSlug(
  operatorAccountId: string,
  raw: unknown
): {ok: true; slug: string} | {ok: false; error: string} {
  if (typeof raw !== 'string') {
    return {ok: false, error: 'Slug is required'};
  }
  const slug = raw.trim().toLowerCase();
  if (!slug || slug.length > 48 || !SLUG_PATTERN.test(slug)) {
    return {ok: false, error: 'Slug must use letters, numbers, and hyphens'};
  }
  const owner = slugOwners.get(slug);
  if (owner && owner !== operatorAccountId) {
    return {ok: false, error: 'Slug is already taken'};
  }
  const previous = accountSlugs.get(operatorAccountId);
  if (previous && previous !== slug) {
    slugOwners.delete(previous);
  }
  slugOwners.set(slug, operatorAccountId);
  accountSlugs.set(operatorAccountId, slug);
  return {ok: true, slug};
}

export function releaseSalonSlug(operatorAccountId: string) {
  const previous = accountSlugs.get(operatorAccountId);
  if (!previous) {
    return;
  }
  slugOwners.delete(previous);
  accountSlugs.delete(operatorAccountId);
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
    console.warn('Service catalog using memory store', error);
    return false;
  }
}

function memoryRows(operatorAccountId: string) {
  return Array.from(memory.services.values()).filter(
    (row) => row.operatorAccountId === operatorAccountId
  );
}

async function rowsForAccount(
  operatorAccountId: string
): Promise<ProvisionedServiceRecord[]> {
  const cached = memoryRows(operatorAccountId);
  if (cached.length) {
    return cached;
  }
  if (!(await tryMongo())) {
    return [];
  }
  const {default: ProvisionedService} = await import(
    '@/app/models/provisionedService'
  );
  const rows = (await ProvisionedService.find({operatorAccountId}).lean()) as
    | ProvisionedServiceRecord[]
    | null;
  for (const row of rows || []) {
    memory.services.set(serviceKey(row.operatorAccountId, row.id), row);
  }
  return rows || [];
}

export async function saveProvisionedService(
  input: Service & {operatorAccountId: string; published: boolean}
): Promise<ProvisionedServiceRecord> {
  const key = serviceKey(input.operatorAccountId, input.id);
  const existing = memory.services.get(key);
  const record: ProvisionedServiceRecord = {
    ...input,
    addOns: input.addOns || [],
    createdAt: existing?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
  memory.services.set(key, record);

  if (await tryMongo()) {
    const {default: ProvisionedService} = await import(
      '@/app/models/provisionedService'
    );
    await ProvisionedService.findOneAndUpdate(
      {operatorAccountId: input.operatorAccountId, id: input.id},
      record,
      {upsert: true, new: true, setDefaultsOnInsert: true}
    );
  }

  return record;
}

async function mirrorRecord(
  record: ProvisionedServiceRecord
): Promise<'skipped' | 'saved' | 'failed'> {
  if (!(await tryMongo())) {
    return 'skipped';
  }
  try {
    const {default: ProvisionedService} = await import(
      '@/app/models/provisionedService'
    );
    const updated = await ProvisionedService.findOneAndUpdate(
      {operatorAccountId: record.operatorAccountId, id: record.id},
      record,
      {upsert: true, new: true, setDefaultsOnInsert: true}
    );
    return updated ? 'saved' : 'failed';
  } catch (error) {
    console.warn('Service catalog mirror failed', error);
    return 'failed';
  }
}

export async function createProvisionedService(
  input: Service & {operatorAccountId: string}
): Promise<ProvisionedServiceRecord> {
  const existing = await rowsForAccount(input.operatorAccountId);
  if (existing.length === 0) {
    for (const service of sharedServices) {
      await saveProvisionedService({
        ...service,
        operatorAccountId: input.operatorAccountId,
        published: false,
      });
    }
  }
  return saveProvisionedService({
    ...input,
    addOns: input.addOns || [],
    operatorAccountId: input.operatorAccountId,
    published: false,
  });
}

export async function updateProvisionedService(
  operatorAccountId: string,
  serviceId: string,
  patch: Partial<Service> & {published?: boolean}
): Promise<ProvisionedServiceRecord | null> {
  const existing = (await rowsForAccount(operatorAccountId)).find(
    (row) => row.id === serviceId
  );
  if (!existing) {
    return null;
  }
  const next: ProvisionedServiceRecord = {
    ...existing,
    ...patch,
    addOns: patch.addOns || existing.addOns || [],
    operatorAccountId,
    id: serviceId,
    createdAt: existing.createdAt,
    updatedAt: nowIso(),
  };
  const key = serviceKey(operatorAccountId, serviceId);
  memory.services.set(key, next);
  if ((await mirrorRecord(next)) === 'failed') {
    memory.services.set(key, existing);
    throw new CatalogMirrorError('Could not save the service');
  }
  return next;
}

export type StorefrontSalon = {
  slug: string;
  operatorAccountId: string;
  services: Array<Service & {published?: boolean}>;
};

export function formatStorefrontAmount(
  service: Pick<Service, 'price' | 'usdChargeCents'>,
  currency: string
) {
  const code = currency.toLowerCase();
  if (code === 'usd') {
    return `${(service.usdChargeCents / 100).toFixed(2)} USD`;
  }
  if (code === 'ngn') {
    return `${service.price} NGN`;
  }
  return `${service.price} ${currency.toUpperCase()}`;
}

async function accountIdForSlug(raw: string) {
  const slug = raw.trim().toLowerCase();
  if (!slug) {
    return null;
  }
  const cached = slugOwners.get(slug);
  if (cached) {
    return cached;
  }
  if (!(await tryMongo())) {
    return null;
  }
  const {default: Salon} = await import('@/app/models/salon');
  const salon = await Salon.findOne({slug}).lean();
  if (!salon?.stripeAccountId || salon.slug !== slug) {
    return null;
  }
  claimSalonSlug(String(salon.stripeAccountId), slug);
  return String(salon.stripeAccountId);
}

export async function salonBySlug(
  raw: string
): Promise<StorefrontSalon | null> {
  const slug = raw.trim().toLowerCase();
  const operatorAccountId = await accountIdForSlug(slug);
  if (!operatorAccountId) {
    return null;
  }
  return {
    slug,
    operatorAccountId,
    services: await resolveServices(operatorAccountId, 'storefront'),
  };
}

export async function listIndexSalons(): Promise<StorefrontSalon[]> {
  if (accountSlugs.size === 0 && (await tryMongo())) {
    const {default: Salon} = await import('@/app/models/salon');
    const salons = await Salon.find({
      slug: {$exists: true, $ne: null},
    }).lean();
    for (const salon of salons || []) {
      if (salon.slug && salon.stripeAccountId) {
        claimSalonSlug(String(salon.stripeAccountId), String(salon.slug));
      }
    }
  }

  const listed: StorefrontSalon[] = [];
  for (const [operatorAccountId, slug] of accountSlugs.entries()) {
    const services = await resolveServices(operatorAccountId, 'storefront');
    if (services.length === 0) {
      continue;
    }
    listed.push({slug, operatorAccountId, services});
  }
  return listed.sort((left, right) => left.slug.localeCompare(right.slug));
}

export async function loadMarketplaceIndex(
  session: {user?: {stripeAccountId?: string | null} | null} | null
): Promise<StorefrontSalon[] | null> {
  if (!session?.user) {
    return null;
  }
  return listIndexSalons();
}

export async function resolveServices(
  operatorAccountId: string,
  mode: CatalogMode
): Promise<Array<Service & {published?: boolean}>> {
  const rows = await rowsForAccount(operatorAccountId);
  if (mode === 'storefront') {
    return rows.filter((row) => row.published);
  }
  if (rows.length === 0) {
    return sharedServices.map((service) => ({...service}));
  }
  return rows;
}
