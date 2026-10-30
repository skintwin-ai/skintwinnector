import Link from 'next/link';
import {stripe} from '@/lib/stripe';
import {formatStorefrontAmount, salonBySlug} from '@/lib/serviceCatalog';

export const dynamic = 'force-dynamic';

async function sellerCurrency(operatorAccountId: string) {
  try {
    const account = await stripe.accounts.retrieve(operatorAccountId);
    return account.default_currency || 'usd';
  } catch {
    return 'usd';
  }
}

export default async function StorefrontPage({
  params,
}: {
  params: {slug: string};
}) {
  const salon = await salonBySlug(params.slug);
  if (!salon) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-4 px-4 py-8">
        <h1 className="text-3xl font-bold">Storefront</h1>
        <p>This storefront is not available.</p>
        <Link className="text-accent" href="/market">
          Back to the marketplace
        </Link>
      </main>
    );
  }

  const currency = await sellerCurrency(salon.operatorAccountId);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-accent">
          SkinTwin storefront
        </p>
        <h1 className="text-3xl font-bold">{salon.slug}</h1>
      </div>
      {salon.services.length === 0 ? (
        <p>Nothing is published on this storefront yet.</p>
      ) : (
        <ul className="space-y-3">
          {salon.services.map((service) => (
            <li
              key={service.id}
              className="flex items-center justify-between gap-4 rounded-lg border p-4"
            >
              <div>
                <h2 className="text-lg font-semibold">{service.name}</h2>
                <p className="text-sm text-subdued">{service.description}</p>
              </div>
              <p className="font-semibold">
                {formatStorefrontAmount(service, currency)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
