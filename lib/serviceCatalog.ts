import servicesData from '@/app/data/services.json';
import type {Service} from '@/app/contexts/booking/types';

export type CatalogMode = 'treatment' | 'storefront';

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

const sharedServices = servicesData as Service[];

function nowIso() {
  return new Date().toISOString();
}

function serviceKey(operatorAccountId: string, serviceId: string) {
  return `${operatorAccountId}:${serviceId}`;
}

export function resetServiceCatalogForTests() {
  memory.services.clear();
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
