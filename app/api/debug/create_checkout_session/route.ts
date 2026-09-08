import {getServerSession} from 'next-auth/next';
import {authOptions} from '@/lib/auth';
import {stripe} from '@/lib/stripe';

const customers = [
  {
    email: 'hydrating_facial@stripe.com',
    name: 'Odie',
    description: 'Hydrating facial treatment',
  },
  {
    email: 'chemical_peel@stripe.com',
    name: 'Snoopy ',
    description: 'Chemical peel session',
  },
  {
    email: 'microdermabrasion@stripe.com',
    name: 'Dug',
    description: 'Microdermabrasion and exfoliation treatment',
  },
  {
    email: 'acne_treatment@stripe.com',
    name: 'Garfield',
    description: 'Acne treatment and extraction',
  },
  {
    email: 'skin_analysis@stripe.com',
    name: 'Bugs Bunny',
    description: 'Full skin analysis and consultation',
  },
];

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function POST() {
  let checkoutSession;
  try {
    const session = await getServerSession(authOptions);
    const currency = 'usd';
    const redirectUrl = `${process.env.NEXTAUTH_URL}/payments`;

    const {description: nameAndDescription} =
      customers[Math.floor(Math.random() * customers.length)];

    let automaticTaxEnabled: boolean = false;
    let taxCode: undefined | string = undefined;
    let tax_behavior: undefined | 'exclusive' = undefined;

    if (session?.user.stripeAccountId) {
      const taxSettings = await stripe.tax.settings.retrieve(
        {},
        {stripeAccount: session?.user.stripeAccountId}
      );
      automaticTaxEnabled = taxSettings.status === 'active';
      taxCode = taxSettings.defaults.tax_code
        ? taxSettings.defaults.tax_code
        : 'txcd_99999999';

      tax_behavior = automaticTaxEnabled ? 'exclusive' : undefined;
    }

    checkoutSession = await stripe.checkout.sessions.create(
      {
        line_items: [
          {
            price_data: {
              unit_amount: getRandomInt(4000, 10000), // Use a random amount if input is not provided
              currency: currency,
              product_data: {
                name: nameAndDescription,
                description: nameAndDescription,
                tax_code: taxCode,
              },
              tax_behavior,
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          description: nameAndDescription,
          statement_descriptor: 'SKINTWIN',
        },
        mode: 'payment',
        success_url: redirectUrl,
        cancel_url: redirectUrl,
        automatic_tax: {
          enabled: automaticTaxEnabled,
        },
      },
      {
        stripeAccount: session?.user.stripeAccountId,
      }
    );

    if (!checkoutSession || !checkoutSession.url) {
      throw new Error('Session URL was not returned');
    }

    return new Response(
      JSON.stringify({
        checkout_session: checkoutSession.url,
      }),
      {status: 200, headers: {'Content-Type': 'application/json'}}
    );
  } catch (error: any) {
    console.error(
      'An error occurred when calling the Stripe API to create a checkout session',
      error
    );
    return new Response(error.message, {status: 500});
  }
}
