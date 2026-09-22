import {NextRequest, NextResponse} from 'next/server';
import {markBookingPayment} from '@/lib/clinicRecords';
import {
  getLocalCheckoutSession,
  isLocalStripeKey,
  payLocalCheckoutSession,
} from '@/lib/localStripeRail';

function jsonError(error: string, status: number) {
  return NextResponse.json({error}, {status});
}

export async function POST(req: NextRequest) {
  if (!isLocalStripeKey()) {
    return jsonError(
      'Local payment rail is disabled while live Stripe keys are set',
      409
    );
  }

  const body = await req.json().catch(() => ({}));
  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : '';
  const existing = getLocalCheckoutSession(sessionId);
  if (!existing) {
    return jsonError('Checkout session not found', 404);
  }

  const session = payLocalCheckoutSession(sessionId);
  if (!session) {
    return jsonError('Checkout session not found', 404);
  }

  try {
    await markBookingPayment({
      checkoutSessionId: session.id,
      operatorAccountId: session.metadata.operatorAccountId || session.account,
      paymentStatus: session.payment_status,
      paymentIntentId: session.payment_intent,
      amountTotal: session.amount_total,
      currency: session.currency,
    });
  } catch (error) {
    console.error('Failed to persist local checkout payment', error);
  }

  const origin = (process.env.NEXTAUTH_URL || new URL(req.url).origin).replace(
    /\/$/,
    ''
  );
  return NextResponse.json({
    sessionId: session.id,
    paymentStatus: session.payment_status,
    confirmationUrl: `${origin}/bookings/confirmation?session_id=${session.id}`,
  });
}
