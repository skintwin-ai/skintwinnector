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
let saveCount = 0;

export function marketplaceOrderSaveCount() {
  return saveCount;
}

function nowIso() {
  return new Date().toISOString();
}

export function resetMarketplaceOrdersForTests() {
  orders.clear();
  saveCount = 0;
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
  saveCount += 1;
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
  const cached =
    Array.from(orders.values()).find(
      (order) =>
        order.idempotencyKey === idempotencyKey &&
        order.paymentStatus === 'unpaid' &&
        order.checkoutUrl
    ) || null;
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
    idempotencyKey,
    paymentStatus: 'unpaid',
  }).lean()) as MarketplaceOrderRecord | null;
  if (!row?.checkoutUrl) {
    return null;
  }
  return remember(row);
}

export async function settleMarketplacePayment(input: {
  order: MarketplaceOrderRecord;
  paymentStatus: string | null | undefined;
  currency: string | null | undefined;
  merchandiseTotal: number | null;
  amountTotal: number | null;
}): Promise<MarketplaceOrderRecord | null> {
  if (input.order.paymentStatus === 'paid') {
    return input.order;
  }
  const currency = (input.currency || '').toLowerCase();
  const merchandiseMatches =
    input.merchandiseTotal === input.order.merchandiseTotal &&
    currency === input.order.currency.toLowerCase();
  if (input.paymentStatus !== 'paid') {
    return input.order;
  }
  if (!merchandiseMatches) {
    return saveMarketplaceOrder({
      ...input.order,
      paymentStatus: 'mismatch',
      mismatch: 'Merchandise or currency did not match the snapshot',
      amountTotal: input.amountTotal,
    });
  }
  return saveMarketplaceOrder({
    ...input.order,
    paymentStatus: 'paid',
    amountTotal: input.amountTotal,
    mismatch: null,
  });
}

export function sessionMerchandiseTotal(session: {
  amount_subtotal?: number | null;
  amount_total?: number | null;
}) {
  return typeof session.amount_subtotal === 'number'
    ? session.amount_subtotal
    : typeof session.amount_total === 'number'
      ? session.amount_total
      : null;
}

export async function loadMarketplaceReceipt(
  orderId: string,
  buyerAccountId: string
) {
  const order = await findMarketplaceOrderForBuyer(orderId, buyerAccountId);
  if (!order?.checkoutSessionId) {
    return null;
  }
  const {stripe} = await import('@/lib/stripe');
  const checkout = await stripe.checkout.sessions.retrieve(
    order.checkoutSessionId,
    {},
    {stripeAccount: order.sellerAccountId}
  );
  return {order, checkout};
}

async function findMarketplaceOrderForBuyer(
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
