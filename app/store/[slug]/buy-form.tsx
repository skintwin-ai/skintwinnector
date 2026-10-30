'use client';

import {useState} from 'react';
import Link from 'next/link';
import {Button} from '@/components/ui/button';
import {startMarketplaceCheckout} from '@/lib/startMarketplaceCheckout';

export function StorefrontBuy({
  slug,
  serviceId,
  signedIn,
  hasAccount,
}: {
  slug: string;
  serviceId: string;
  signedIn: boolean;
  hasAccount: boolean;
}) {
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  if (!signedIn) {
    return (
      <Link
        className="text-sm font-medium text-accent"
        href={`/login?next=/store/${slug}`}
      >
        Sign in to buy
      </Link>
    );
  }

  if (!hasAccount) {
    return (
      <Link
        className="text-sm font-medium text-accent"
        href={`/business?next=/store/${slug}`}
      >
        Create a salon account to buy
      </Link>
    );
  }

  return (
    <form
      className="flex flex-col items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        setPending(true);
        setError('');
        startMarketplaceCheckout({slug, serviceId, quantity})
          .then((result) => {
            window.location.assign(result.checkoutUrl);
          })
          .catch((checkoutError: Error) => {
            setError(checkoutError.message);
            setPending(false);
          });
      }}
    >
      <label className="flex items-center gap-2 text-sm">
        Qty
        <input
          className="w-16 rounded border px-2 py-1"
          type="number"
          min={1}
          max={100}
          value={quantity}
          aria-label={`Quantity for ${serviceId}`}
          onChange={(event) => setQuantity(Number(event.target.value))}
        />
      </label>
      <Button className="btn-cobalt" type="submit" disabled={pending}>
        Buy
      </Button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  );
}
