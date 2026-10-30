import {getServerSession} from 'next-auth';
import {NextRequest, NextResponse} from 'next/server';
import {authOptions} from '@/lib/auth';
import {markBookingPayment} from '@/lib/clinicRecords';
import {
  findMarketplaceOrderBySession,
  sessionMerchandiseTotal,
  settleMarketplacePayment,
} from '@/lib/marketplaceOrders';
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

  const marketplaceOrder = await findMarketplaceOrderBySession(
    existing.account,
    existing.id
  );
  if (marketplaceOrder) {
    const buyer = await getServerSession(authOptions);
    if (buyer?.user?.stripeAccountId !== marketplaceOrder.buyerAccountId) {
      return jsonError('Only the buying salon can confirm this payment', 403);
    }
    const merchandise = sessionMerchandiseTotal(existing);
    const currencyMatches =
      existing.currency.toLowerCase() ===
      marketplaceOrder.currency.toLowerCase();
    if (!currencyMatches || merchandise !== marketplaceOrder.merchandiseTotal) {
      return jsonError('Checkout total does not match the order', 400);
    }
    const settled = await settleMarketplacePayment({
      order: marketplaceOrder,
      paymentStatus: 'paid',
      currency: existing.currency,
      merchandiseTotal: merchandise,
      amountTotal: existing.amount_total,
    });
    if (!settled || settled.paymentStatus !== 'paid') {
      return jsonError('Unable to update the marketplace order', 500);
    }
    const session = payLocalCheckoutSession(sessionId);
    if (!session) {
      return jsonError('Checkout session not found', 404);
    }
    const origin = (
      process.env.NEXTAUTH_URL || new URL(req.url).origin
    ).replace(/\/$/, '');
    return NextResponse.json({
      sessionId: session.id,
      paymentStatus: settled.paymentStatus,
      confirmationUrl: `${origin}/market/orders/${settled.id}?session_id=${session.id}`,
    });
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
