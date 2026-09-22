import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getLocalCheckoutSession} from '@/lib/localStripeRail';
import {PayLocalCheckout} from './pay-form';

export default function LocalCheckoutPage({
  params,
}: {
  params: {sessionId: string};
}) {
  const session = getLocalCheckoutSession(params.sessionId);
  if (!session) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-lg space-y-4 p-6">
      <h1 className="text-2xl font-semibold">SkinTwin local checkout</h1>
      <p className="text-subdued">
        Live Stripe keys are not configured. This rail settles the same booking
        record the hosted Checkout webhook would mark paid.
      </p>
      <dl className="space-y-2 rounded-md border border-[color:var(--hairline)] p-4">
        <div>
          <dt className="text-sm text-subdued">Session</dt>
          <dd data-testid="local-checkout-session">{session.id}</dd>
        </div>
        <div>
          <dt className="text-sm text-subdued">Amount</dt>
          <dd data-testid="local-checkout-amount">
            {session.currency.toUpperCase()}{' '}
            {(session.amount_total / 100).toFixed(2)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-subdued">Customer</dt>
          <dd>{session.customer_email || 'Clinic client'}</dd>
        </div>
        <div>
          <dt className="text-sm text-subdued">Status</dt>
          <dd data-testid="local-checkout-status">{session.payment_status}</dd>
        </div>
      </dl>
      {session.payment_status === 'paid' ? (
        <Link
          className="inline-flex rounded-md bg-accent px-4 py-2 font-medium text-white"
          href={`/bookings/confirmation?session_id=${session.id}`}
        >
          View confirmation
        </Link>
      ) : (
        <PayLocalCheckout sessionId={session.id} />
      )}
    </main>
  );
}
