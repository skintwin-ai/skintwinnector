'use client';

import {useState} from 'react';
import {useRouter} from 'next/navigation';

export function PayLocalCheckout({sessionId}: {sessionId: string}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function pay() {
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/payments/local/confirm', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({sessionId}),
      });
      const payload = await response.json();
      if (!response.ok || !payload.confirmationUrl) {
        throw new Error(payload.error || 'Unable to settle checkout');
      }
      router.push(payload.confirmationUrl);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to settle checkout'
      );
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={pay}
        disabled={pending}
        data-testid="local-checkout-pay"
        className="w-full rounded-md bg-accent px-4 py-2 font-medium text-white"
      >
        {pending ? 'Settling…' : 'Pay and confirm booking'}
      </button>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
