export type MarketplaceOrderLine = {
  serviceId: string;
  name: string;
  quantity: number;
  unitAmount: number;
};

export type MarketplaceOrderRecord = {
  id: string;
  sellerAccountId: string;
  buyerAccountId: string;
  checkoutSessionId: string | null;
  checkoutUrl: string | null;
  currency: string;
  merchandiseTotal: number;
  amountTotal: number | null;
  paymentStatus: 'unpaid' | 'paid' | 'mismatch';
  lines: MarketplaceOrderLine[];
  mismatch: string | null;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
};

const orders = new Map<string, MarketplaceOrderRecord>();

function nowIso() {
  return new Date().toISOString();
}

export function resetMarketplaceOrdersForTests() {
  orders.clear();
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
    console.warn('Marketplace orders using memory store', error);
    return false;
  }
}

function remember(record: MarketplaceOrderRecord) {
  orders.set(record.id, record);
  return record;
}

export async function saveMarketplaceOrder(
  input: Omit<MarketplaceOrderRecord, 'createdAt' | 'updatedAt'> & {
    createdAt?: string;
    updatedAt?: string;
  }
): Promise<MarketplaceOrderRecord | null> {
  const existing = orders.get(input.id);
  const record: MarketplaceOrderRecord = {
    ...input,
    createdAt: existing?.createdAt || input.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
  remember(record);
  if (await tryMongo()) {
    try {
      const {default: MarketplaceOrder} = await import(
        '@/app/models/marketplaceOrder'
      );
      const updated = await MarketplaceOrder.findOneAndUpdate(
        {id: record.id},
        record,
        {upsert: true, new: true, setDefaultsOnInsert: true}
      );
      if (!updated) {
        orders.delete(record.id);
        return null;
      }
    } catch (error) {
      console.warn('Marketplace order mirror failed', error);
      orders.delete(record.id);
      return null;
    }
  }
  return record;
}

export async function findMarketplaceOrderBySession(
  sellerAccountId: string,
  checkoutSessionId: string
): Promise<MarketplaceOrderRecord | null> {
  const cached = Array.from(orders.values()).find(
    (order) =>
      order.sellerAccountId === sellerAccountId &&
      order.checkoutSessionId === checkoutSessionId
  );
  if (cached) {
    return cached;
  }
  if (!(await tryMongo())) {
    return null;
  }
  const {default: MarketplaceOrder} = await import(
    '@/app/models/marketplaceOrder'
  );
  const row = (await MarketplaceOrder.findOne({
    sellerAccountId,
    checkoutSessionId,
  }).lean()) as MarketplaceOrderRecord | null;
  if (!row) {
    return null;
  }
  return remember(row);
}

export async function findUnpaidOrderByKey(idempotencyKey: string) {
  return (
    Array.from(orders.values()).find(
      (order) =>
        order.idempotencyKey === idempotencyKey &&
        order.paymentStatus === 'unpaid' &&
        order.checkoutUrl
    ) || null
  );
}

export async function findMarketplaceOrderForBuyer(
  orderId: string,
  buyerAccountId: string
) {
  const cached = orders.get(orderId);
  if (cached) {
    return cached.buyerAccountId === buyerAccountId ? cached : null;
  }
  if (!(await tryMongo())) {
    return null;
  }
  const {default: MarketplaceOrder} = await import(
    '@/app/models/marketplaceOrder'
  );
  const row = (await MarketplaceOrder.findOne({
    id: orderId,
    buyerAccountId,
  }).lean()) as MarketplaceOrderRecord | null;
  return row ? remember(row) : null;
}
