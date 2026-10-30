import Link from 'next/link';
import {redirect} from 'next/navigation';
import {getServerSession} from 'next-auth';
import {authOptions} from '@/lib/auth';
import {loadMarketplaceIndex} from '@/lib/serviceCatalog';

export const dynamic = 'force-dynamic';

export default async function MarketIndexPage() {
  const session = await getServerSession(authOptions);
  const salons = await loadMarketplaceIndex(session);
  if (!salons) {
    redirect('/login?next=/market');
  }

  return (
    <>
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-accent">
          SkinTwin marketplace
        </p>
        <h1 className="text-3xl font-bold">Storefronts</h1>
      </div>
      {salons.length === 0 ? (
        <p>No published storefront is available yet.</p>
      ) : (
        <ul className="space-y-3">
          {salons.map((salon) => (
            <li key={salon.slug}>
              <Link
                className="text-lg font-semibold text-accent"
                href={`/store/${salon.slug}`}
              >
                {salon.slug}
              </Link>
              <p className="text-sm text-subdued">
                {salon.services.length} published{' '}
                {salon.services.length === 1 ? 'service' : 'services'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
