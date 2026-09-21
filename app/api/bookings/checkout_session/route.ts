import {getServerSession} from 'next-auth';
import {NextRequest} from 'next/server';
import {isCheckoutSessionId} from '@/lib/bookingCheckout';
import {authOptions} from '@/lib/auth';
import {stripe} from '@/lib/stripe';

function jsonError(error: string, status: number) {
  return new Response(JSON.stringify({error}), {
    status,
    headers: {'Content-Type': 'application/json'},
  });
}

function isMissingSession(error: any) {
  return error?.code === 'resource_missing' || error?.statusCode === 404;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.stripeAccountId) {
      return jsonError('Unauthorized or no Stripe account found', 401);
    }

    const sessionId = req.nextUrl.searchParams.get('session_id');
    if (!isCheckoutSessionId(sessionId)) {
      return jsonError('Checkout session not found', 404);
    }

    let checkoutSession;
    try {
      checkoutSession = await stripe.checkout.sessions.retrieve(
        sessionId,
        {},
        {stripeAccount: session.user.stripeAccountId}
      );
    } catch (error: any) {
      if (isMissingSession(error)) {
        return jsonError('Checkout session not found', 404);
      }
      throw error;
    }

    if (
      checkoutSession.metadata?.operatorAccountId !==
      session.user.stripeAccountId
    ) {
      return jsonError('Checkout session not found', 404);
    }

    const paymentIntent = checkoutSession.payment_intent;
    const paymentIntentId =
      typeof paymentIntent === 'string'
        ? paymentIntent
        : paymentIntent?.id || null;

    console.log('Retrieved booking checkout session', {
      sessionId: checkoutSession.id,
      draftId: checkoutSession.metadata?.draftId,
    });

    return new Response(
      JSON.stringify({
        sessionId: checkoutSession.id,
        paymentStatus: checkoutSession.payment_status,
        amountTotal: checkoutSession.amount_total,
        currency: checkoutSession.currency,
        paymentIntentId,
        metadata: checkoutSession.metadata || {},
      }),
      {status: 200, headers: {'Content-Type': 'application/json'}}
    );
  } catch (error: any) {
    console.error(
      'An error occurred when retrieving a booking checkout session',
      error
    );
    return jsonError(
      error.message || 'Unable to retrieve checkout session',
      500
    );
  }
}
