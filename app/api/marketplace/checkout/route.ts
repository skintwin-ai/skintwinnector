import {getServerSession} from 'next-auth';
import {NextRequest, NextResponse} from 'next/server';
import {authOptions} from '@/lib/auth';
import {
  assertSupportedSellerCurrency,
  bodyContainsForbiddenCheckoutFields,
  marketplaceFee,
  marketplaceIdempotencyKey,
  priceMarketplaceSelections,
  sellerCanCharge,
} from '@/lib/marketplaceCheckout';
import {
  findUnpaidOrderByKey,
  saveMarketplaceOrder,
} from '@/lib/marketplaceOrders';
import {salonBySlug, resolveServices} from '@/lib/serviceCatalog';
import {isSupportedChargeCurrency} from '@/lib/bookingCheckout';
import {stripe} from '@/lib/stripe';

function jsonError(error: string, status: number) {
  return NextResponse.json({error}, {status});
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const buyerAccountId = session?.user?.stripeAccountId;
  if (!buyerAccountId) {
    return jsonError('Unauthorized or no Stripe account found', 401);
  }

  const origin = process.env.NEXTAUTH_URL;
  if (!origin) {
    return jsonError('NEXTAUTH_URL is not configured', 500);
  }

  const body = await req.json();
  if (bodyContainsForbiddenCheckoutFields(body)) {
    return jsonError('Client-supplied prices are not allowed', 400);
  }

  const slug = typeof body?.slug === 'string' ? body.slug : '';
  const salon = slug ? await salonBySlug(slug) : null;
  if (!salon) {
    return jsonError('Storefront not found', 404);
  }
  if (salon.operatorAccountId === buyerAccountId) {
    return jsonError('A salon cannot buy from its own storefront', 400);
  }

  const sellerAccountId = salon.operatorAccountId;
  const [sellerAccount, taxSettings] = await Promise.all([
    stripe.accounts.retrieve(sellerAccountId),
    stripe.tax.settings.retrieve({}, {stripeAccount: sellerAccountId}),
  ]);
  if (!sellerCanCharge(sellerAccount)) {
    return jsonError('This storefront cannot accept charges yet', 400);
  }
  const chargeCurrency = sellerAccount.default_currency;
  const currencyError = assertSupportedSellerCurrency(chargeCurrency);
  if (currencyError || !isSupportedChargeCurrency(chargeCurrency)) {
    return jsonError(currencyError || 'Unsupported charge currency', 400);
  }

  const catalog = await resolveServices(sellerAccountId, 'storefront');
  const priced = priceMarketplaceSelections(
    body?.services,
    catalog,
    chargeCurrency
  );
  if (!priced.ok) {
    return jsonError(priced.error, 400);
  }

  const idempotencyKey = marketplaceIdempotencyKey(
    buyerAccountId,
    sellerAccountId,
    priced.lines
  );
  const existing = await findUnpaidOrderByKey(idempotencyKey);
  if (existing?.checkoutUrl) {
    return NextResponse.json({
      checkoutUrl: existing.checkoutUrl,
      orderId: existing.id,
    });
  }

  const orderId = `ord_${crypto.randomUUID()}`;
  const receiptUrl = `${origin}/market/orders/${orderId}?session_id={CHECKOUT_SESSION_ID}`;
  const fee = marketplaceFee(priced.merchandiseTotal);
  const automaticTaxEnabled = taxSettings?.status === 'active';
  const taxCode = taxSettings?.defaults?.tax_code || 'txcd_99999999';
  const taxBehavior = automaticTaxEnabled ? 'exclusive' : undefined;

  const checkoutSession = await stripe.checkout.sessions.create(
    {
      line_items: priced.lines.map((line) => ({
        quantity: line.quantity,
        price_data: {
          currency: chargeCurrency,
          unit_amount: line.unitAmount,
          tax_behavior: taxBehavior,
          product_data: {
            name: line.name,
            tax_code: automaticTaxEnabled ? taxCode : undefined,
          },
        },
      })),
      metadata: {
        orderKind: 'marketplace',
      },
      mode: 'payment',
      success_url: receiptUrl,
      cancel_url: receiptUrl,
      automatic_tax: {enabled: automaticTaxEnabled},
      payment_intent_data: fee > 0 ? {application_fee_amount: fee} : undefined,
    },
    {
      stripeAccount: sellerAccountId,
      idempotencyKey,
    }
  );

  if (!checkoutSession?.url || !checkoutSession.id) {
    return jsonError('Session URL was not returned', 500);
  }

  const saved = await saveMarketplaceOrder({
    id: orderId,
    sellerAccountId,
    buyerAccountId,
    checkoutSessionId: checkoutSession.id,
    checkoutUrl: checkoutSession.url,
    currency: chargeCurrency,
    merchandiseTotal: priced.merchandiseTotal,
    amountTotal: null,
    paymentStatus: 'unpaid',
    lines: priced.lines,
    mismatch: null,
    idempotencyKey,
  });
  if (!saved) {
    return jsonError('Unable to store the marketplace order', 500);
  }

  return NextResponse.json({
    checkoutUrl: saved.checkoutUrl,
    orderId: saved.id,
  });
}
