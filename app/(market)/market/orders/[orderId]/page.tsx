import Link from 'next/link';
import {redirect} from 'next/navigation';
import {getServerSession} from 'next-auth';
import {authOptions} from '@/lib/auth';
import {loadMarketplaceReceipt} from '@/lib/marketplaceOrders';
import {slugForAccount} from '@/lib/serviceCatalog';
import {ReceiptRefresh} from './refresh';

export const dynamic = 'force-dynamic';

export default async function MarketplaceReceiptPage({
  params,
}: {
  params: {orderId: string};
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect(`/login?next=/market/orders/${params.orderId}`);
  }
  const buyerAccountId = session.user.stripeAccountId;
  const loaded = buyerAccountId
    ? await loadMarketplaceReceipt(params.orderId, buyerAccountId)
    : null;
  if (!loaded) {
    return <p>This receipt is unavailable.</p>;
  }

  const {order, checkout} = loaded;
  const slug = slugForAccount(order.sellerAccountId);
  const waiting =
    checkout.payment_status === 'paid' &&
    order.paymentStatus === 'unpaid' &&
    !order.mismatch;

  return (
    <>
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-accent">
          SkinTwin receipt
        </p>
        <h1 className="text-3xl font-bold">Order {order.id}</h1>
      </div>
      <dl className="space-y-2">
        <div>
          <dt className="text-sm text-subdued">Checkout</dt>
          <dd>{checkout.payment_status}</dd>
        </div>
        <div>
          <dt className="text-sm text-subdued">Order</dt>
          <dd>{order.paymentStatus}</dd>
        </div>
        {order.mismatch && (
          <div>
            <dt className="text-sm text-subdued">Mismatch</dt>
            <dd>{order.mismatch}</dd>
          </div>
        )}
      </dl>
      {waiting && <ReceiptRefresh />}
      {checkout.payment_status !== 'paid' && slug && (
        <Link className="text-accent" href={`/store/${slug}`}>
          Back to the storefront
        </Link>
      )}
    </>
  );
}
