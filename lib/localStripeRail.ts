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

const sessions = new Map<string, LocalCheckoutSession>();
let seq = 0;

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
  return sessions.get(id) || null;
}

export function payLocalCheckoutSession(id: string) {
  const session = sessions.get(id);
  if (!session) {
    return null;
  }
  session.payment_status = 'paid';
  return session;
}

export function resetLocalStripeForTests() {
  sessions.clear();
  seq = 0;
}

function missingSession() {
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
          seq += 1;
          const id = `cs_local_${Date.now()}_${seq}`;
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
          sessions.set(id, session);
          return session;
        },
        async expire(id: string) {
          const session = sessions.get(id);
          if (session && session.payment_status !== 'paid') {
            session.status = 'expired';
          }
          return session || {};
        },
        async retrieve(
          id: string,
          _opts?: unknown,
          options?: {stripeAccount?: string}
        ) {
          const session = sessions.get(id);
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
