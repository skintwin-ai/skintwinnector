import {getServerSession} from 'next-auth';
import {NextRequest} from 'next/server';
import type {Service} from '@/app/contexts/booking/types';
import servicesData from '@/app/data/services.json';
import {
  BookingCheckoutValidationError,
  bodyContainsClientPricing,
  bookingIdempotencyKey,
  buildCheckoutLineItems,
  encodeSelectionMetadata,
} from '@/lib/bookingCheckout';
import {authOptions} from '@/lib/auth';
import {stripe} from '@/lib/stripe';

const catalog = servicesData as Service[];

function jsonError(error: string, status: number) {
  return new Response(JSON.stringify({error}), {
    status,
    headers: {'Content-Type': 'application/json'},
  });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.stripeAccountId) {
      return jsonError('Unauthorized or no Stripe account found', 401);
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

    const stripeAccount = await stripe.accounts.retrieve(
      session.user.stripeAccountId
    );
    if (stripeAccount.default_currency !== 'usd') {
      return jsonError(
        'This increment only charges connected accounts whose default currency is USD',
        400
      );
    }

    let automaticTaxEnabled = false;
    let taxCode: string | undefined;
    let taxBehavior: 'exclusive' | undefined;
    try {
      const taxSettings = await stripe.tax.settings.retrieve(
        {},
        {stripeAccount: session.user.stripeAccountId}
      );
      automaticTaxEnabled = taxSettings.status === 'active';
      taxCode = taxSettings.defaults.tax_code || 'txcd_99999999';
      taxBehavior = automaticTaxEnabled ? 'exclusive' : undefined;
    } catch {
      automaticTaxEnabled = false;
    }

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

    const origin = process.env.NEXTAUTH_URL;
    if (!origin) {
      return jsonError('NEXTAUTH_URL is not configured', 500);
    }
    const returnUrl = `${origin}/bookings/confirmation?session_id={CHECKOUT_SESSION_ID}`;
    const idempotencyKey = bookingIdempotencyKey(draftId, body.retryAttempt);

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

    return new Response(
      JSON.stringify({
        checkoutUrl: checkoutSession.url,
        sessionId: checkoutSession.id,
      }),
      {status: 200, headers: {'Content-Type': 'application/json'}}
    );
  } catch (error: any) {
    console.error(
      'An error occurred when creating a booking checkout session',
      error
    );
    return jsonError(error.message || 'Unable to create checkout session', 500);
  }
}
