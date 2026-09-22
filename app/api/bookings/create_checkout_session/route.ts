import {getServerSession} from 'next-auth';
import {NextRequest, NextResponse} from 'next/server';
import servicesData from '@/app/data/services.json';
import {
  BookingCheckoutValidationError,
  bodyContainsClientPricing,
  bookingIdempotencyKey,
  buildCheckoutLineItems,
  encodeSelectionMetadata,
  isCheckoutSessionId,
  type CheckoutCatalogService,
} from '@/lib/bookingCheckout';
import {authOptions} from '@/lib/auth';
import {persistCheckoutBooking} from '@/lib/clinicRecords';
import {stripe} from '@/lib/stripe';

const catalog = servicesData as CheckoutCatalogService[];

function jsonError(error: string, status: number) {
  return NextResponse.json({error}, {status});
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.stripeAccountId) {
      return jsonError('Unauthorized or no Stripe account found', 401);
    }

    const origin = process.env.NEXTAUTH_URL;
    if (!origin) {
      return jsonError('NEXTAUTH_URL is not configured', 500);
    }

    const body = await req.json();
    if (bodyContainsClientPricing(body)) {
      return jsonError('Client-supplied prices are not allowed', 400);
    }

    const draftId =
      typeof body?.draftId === 'string' ? body.draftId.trim() : '';
    if (!draftId) {
      return jsonError('draftId is required', 400);
    }

    const clientEmail =
      typeof body?.client?.email === 'string' ? body.client.email.trim() : '';
    if (!clientEmail) {
      return jsonError('Client email is required', 400);
    }

    const selections = Array.isArray(body?.services) ? body.services : [];
    let built;
    try {
      built = buildCheckoutLineItems(selections, catalog, 'usd');
    } catch (error) {
      if (error instanceof BookingCheckoutValidationError) {
        return jsonError(error.message, 400);
      }
      throw error;
    }

    const [stripeAccount, taxSettings] = await Promise.all([
      stripe.accounts.retrieve(session.user.stripeAccountId),
      stripe.tax.settings.retrieve(
        {},
        {stripeAccount: session.user.stripeAccountId}
      ),
    ]);
    if (stripeAccount.default_currency !== 'usd') {
      return jsonError(
        'This increment only charges connected accounts whose default currency is USD',
        400
      );
    }

    const automaticTaxEnabled = taxSettings?.status === 'active';
    const taxCode = taxSettings?.defaults.tax_code || 'txcd_99999999';
    const taxBehavior = automaticTaxEnabled ? 'exclusive' : undefined;

    const lineItems = built.lineItems.map((item) => ({
      ...item,
      price_data: {
        ...item.price_data,
        tax_behavior: taxBehavior,
        product_data: {
          ...item.price_data.product_data,
          tax_code: automaticTaxEnabled ? taxCode : undefined,
        },
      },
    }));

    const returnUrl = `${origin}/bookings/confirmation?session_id={CHECKOUT_SESSION_ID}`;
    const idempotencyKey = bookingIdempotencyKey(draftId, body.retryAttempt);
    const previousSessionId =
      typeof body.replaceSessionId === 'string' ? body.replaceSessionId : '';
    if (isCheckoutSessionId(previousSessionId)) {
      try {
        await stripe.checkout.sessions.expire(
          previousSessionId,
          {},
          {stripeAccount: session.user.stripeAccountId}
        );
      } catch {
        // Previous session may already be expired or complete.
      }
    }

    const checkoutSession = await stripe.checkout.sessions.create(
      {
        line_items: lineItems,
        customer_email: clientEmail,
        metadata: {
          draftId,
          operatorAccountId: session.user.stripeAccountId,
          selections: encodeSelectionMetadata(selections),
        },
        mode: 'payment',
        success_url: returnUrl,
        cancel_url: returnUrl,
        automatic_tax: {enabled: automaticTaxEnabled},
      },
      {
        stripeAccount: session.user.stripeAccountId,
        idempotencyKey,
      }
    );

    if (!checkoutSession?.url || !checkoutSession.id) {
      return jsonError('Session URL was not returned', 500);
    }

    console.log('Created booking checkout session', {
      sessionId: checkoutSession.id,
      draftId,
    });

    try {
      await persistCheckoutBooking({
        operatorAccountId: session.user.stripeAccountId,
        draftId,
        checkoutSessionId: checkoutSession.id,
        paymentStatus: checkoutSession.payment_status || 'unpaid',
        amountTotal: checkoutSession.amount_total,
        currency: checkoutSession.currency,
        displayTotal: built.displayTotal,
        services: selections,
        appointment: body.appointment,
        client: body.client,
      });
    } catch (error) {
      console.error('Failed to persist booking draft', error);
    }

    return NextResponse.json({
      checkoutUrl: checkoutSession.url,
      sessionId: checkoutSession.id,
    });
  } catch (error: any) {
    console.error(
      'An error occurred when creating a booking checkout session',
      error
    );
    return jsonError(error.message || 'Unable to create checkout session', 500);
  }
}
