'use client';

import {useCallback, useEffect, useState} from 'react';
import type {Service} from '@/app/contexts/booking/types';

export type TreatmentService = Service & {published?: boolean};

export function useTreatmentCatalog() {
  const [services, setServices] = useState<TreatmentService[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const response = await fetch('/api/services');
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Unable to load services');
    }
    setServices(payload.services || []);
    setError('');
    return payload.services as TreatmentService[];
  }, []);

  useEffect(() => {
    let cancelled = false;
    reload()
      .catch((loadError: Error) => {
        if (!cancelled) {
          setError(loadError.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  return {services, error, setError, loading, reload};
}
