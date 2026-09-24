import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import {dirname, join} from 'node:path';
import {tmpdir} from 'node:os';

export type LocalCheckoutSession = {
  id: string;
  url: string;
  payment_status: 'unpaid' | 'paid';
  amount_total: number;
  currency: string;
  customer_email?: string;
  metadata: Record<string, string>;
  payment_intent: string;
  account: string;
  status?: string;
};

type Store = {
  seq: number;
  sessions: Record<string, LocalCheckoutSession>;
};

function storePath() {
  return (
    process.env.SKINTWIN_LOCAL_STRIPE_STORE ||
    join(tmpdir(), 'skintwin-local-stripe.json')
  );
}

function emptyStore(): Store {
  return {seq: 0, sessions: {}};
}

function readStore(): Store {
  try {
    const parsed = JSON.parse(readFileSync(storePath(), 'utf8')) as Store;
    if (!parsed || typeof parsed !== 'object') {
      return emptyStore();
    }
    return {
      seq: Number(parsed.seq) || 0,
      sessions: parsed.sessions || {},
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: Store) {
  const path = storePath();
  mkdirSync(dirname(path), {recursive: true});
  writeFileSync(path, JSON.stringify(store));
}

export function isLocalStripeKey(key = process.env.STRIPE_SECRET_KEY || '') {
  return (
    !key ||
    /placeholder|changeme|your.?key|sk_test_\*+/i.test(key) ||
    key.length < 16
  );
}

export function localAccountIdForEmail(email: string) {
  const slug = email
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return `acct_local_${slug || 'operator'}`;
}

export function getLocalCheckoutSession(id: string) {
  return readStore().sessions[id] || null;
}

export function payLocalCheckoutSession(id: string) {
  const store = readStore();
  const session = store.sessions[id];
  if (!session) {
    return null;
  }
  session.payment_status = 'paid';
  store.sessions[id] = session;
  writeStore(store);
  return session;
}

export function resetLocalStripeForTests() {
  const path = storePath();
  if (existsSync(path)) {
    unlinkSync(path);
  }
}

function missingSession(): never {
  const error = new Error('No such checkout session') as Error & {
    code: string;
    statusCode: number;
  };
  error.code = 'resource_missing';
  error.statusCode = 404;
  throw error;
}

export function createLocalStripe() {
  return {
    accounts: {
      async retrieve(id: string) {
        return {id, default_currency: 'usd'};
      },
    },
    tax: {
      settings: {
        async retrieve() {
          return {status: 'inactive', defaults: {}};
        },
      },
    },
    checkout: {
      sessions: {
        async create(
          params: {
            line_items?: Array<{
              price_data?: {unit_amount?: number; currency?: string};
              quantity?: number;
            }>;
            customer_email?: string;
            metadata?: Record<string, string>;
          },
          options?: {stripeAccount?: string}
        ) {
          const store = readStore();
          store.seq += 1;
          const id = `cs_local_${Date.now()}_${store.seq}`;
          const origin = (
            process.env.NEXTAUTH_URL || 'http://localhost:3000'
          ).replace(/\/$/, '');
          const amount = (params.line_items || []).reduce((sum, item) => {
            return (
              sum + (item.price_data?.unit_amount || 0) * (item.quantity || 1)
            );
          }, 0);
          const session: LocalCheckoutSession = {
            id,
            url: `${origin}/pay/local/${id}`,
            payment_status: 'unpaid',
            amount_total: amount,
            currency: params.line_items?.[0]?.price_data?.currency || 'usd',
            customer_email: params.customer_email,
            metadata: params.metadata || {},
            payment_intent: `pi_local_${id}`,
            account: options?.stripeAccount || 'acct_local',
          };
          store.sessions[id] = session;
          writeStore(store);
          return session;
        },
        async expire(id: string) {
          const store = readStore();
          const session = store.sessions[id];
          if (session && session.payment_status !== 'paid') {
            session.status = 'expired';
            store.sessions[id] = session;
            writeStore(store);
          }
          return session || {};
        },
        async retrieve(
          id: string,
          _opts?: unknown,
          options?: {stripeAccount?: string}
        ) {
          const session = getLocalCheckoutSession(id);
          if (!session) {
            missingSession();
          }
          if (
            options?.stripeAccount &&
            session.account !== options.stripeAccount
          ) {
            missingSession();
          }
          return session;
        },
      },
    },
    webhooks: {
      constructEvent(body: string) {
        return JSON.parse(body);
      },
    },
  };
}
