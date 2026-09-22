import {type NextRequest} from 'next/server';
import {NextResponse} from 'next/server';
import {stripe} from '@/lib/stripe';

function jsonError(error: string, status: number) {
  return NextResponse.json({error}, {status});
}

function constructWebhookEvent(body: string, sig: string) {
  const secrets = [
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
  ].filter((secret): secret is string => Boolean(secret));

  let lastError: unknown;
  for (const secret of secrets) {
    try {
      return stripe.webhooks.constructEvent(body, sig, secret);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function logBookingCheckoutEvent(event: {
  type: string;
  account?: string | null;
  data: {object: {id?: string; metadata?: Record<string, string> | null}};
}) {
  if (!event.account) {
    return;
  }
  const sessionId = event.data.object.id;
  const eventMetadata = event.data.object.metadata;
  if (
    !sessionId ||
    !eventMetadata?.draftId ||
    eventMetadata.operatorAccountId !== event.account
  ) {
    return;
  }

  const retrieved = await stripe.checkout.sessions.retrieve(
    sessionId,
    {},
    {stripeAccount: event.account}
  );
  const draftId = retrieved.metadata?.draftId;
  const operatorAccountId = retrieved.metadata?.operatorAccountId;
  if (!draftId || operatorAccountId !== event.account) {
    return;
  }

  console.log('Booking checkout webhook', {
    sessionId: retrieved.id,
    paymentStatus: retrieved.payment_status,
    draftId,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.text();

  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    return jsonError('Cannot find the webhook signature', 400);
  }

  const secrets = [
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
  ].filter(Boolean);
  if (secrets.length === 0) {
    return jsonError('Cannot find the webhook secret', 400);
  }

  let event;
  try {
    event = constructWebhookEvent(body, sig);
  } catch (err: any) {
    return jsonError(`Webhook Error: ${err.message}`, 400);
  }

  switch (event.type) {
    case 'account.updated':
      break;
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      try {
        await logBookingCheckoutEvent(event);
      } catch (error) {
        console.error('Booking checkout webhook retrieve failed', error);
      }
      break;
    default:
      console.log('Unhandled event type', event.type);
      break;
  }

  return NextResponse.json({});
}
