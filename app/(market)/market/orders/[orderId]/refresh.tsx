'use client';

import {useEffect} from 'react';
import {useRouter} from 'next/navigation';

export function ReceiptRefresh() {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => {
      router.refresh();
    }, 2000);
    return () => clearInterval(timer);
  }, [router]);
  return <p className="text-sm text-subdued">Confirming payment…</p>;
}
