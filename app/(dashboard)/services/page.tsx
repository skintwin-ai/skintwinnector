'use client';

import {useEffect, useState, type FormEvent} from 'react';
import Link from 'next/link';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import Container from '@/app/components/Container';
import ServiceCatalog from '@/app/components/skintwin/ServiceCatalog';
import BookingBasket from '@/app/components/skintwin/BookingBasket';
import {useBooking} from '@/app/contexts/booking/BookingContext';
import {
  useTreatmentCatalog,
  type TreatmentService,
} from '@/app/hooks/useTreatmentCatalog';
import {PROVIDER_TYPES, PROVIDER_TYPE_LABELS} from '@/lib/providerTypes';

function isStoredService(service: TreatmentService) {
  return typeof service.published === 'boolean';
}

export default function ServicesPage() {
  const booking = useBooking();
  const {services, error, setError, loading, reload} = useTreatmentCatalog();
  const [slug, setSlug] = useState('');
  const [slugInput, setSlugInput] = useState('');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [usdChargeCents, setUsdChargeCents] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [providerTypes, setProviderTypes] = useState<string[]>(['esthetician']);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/storefront')
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || 'Unable to load storefront');
        }
        if (!cancelled && typeof payload.slug === 'string') {
          setSlug(payload.slug);
          setSlugInput(payload.slug);
        }
      })
      .catch((loadError: Error) => {
        if (!cancelled) {
          setError(loadError.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [setError]);

  const stored = services.filter(isStoredService);

  async function claimSlug(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/storefront', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({slug: slugInput}),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to save slug');
      }
      setSlug(payload.slug);
      setSlugInput(payload.slug);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Unable to save slug'
      );
    } finally {
      setSaving(false);
    }
  }

  async function createService(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/services', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({
          name,
          price: Number(price),
          usdChargeCents: Number(usdChargeCents),
          durationMinutes: Number(durationMinutes),
          providerTypes,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to save service');
      }
      setName('');
      await reload();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to save service'
      );
    } finally {
      setSaving(false);
    }
  }

  async function setPublished(service: TreatmentService, published: boolean) {
    setError('');
    try {
      const response = await fetch(`/api/services/${service.id}`, {
        method: 'PATCH',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({published}),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to update service');
      }
      await reload();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to update service'
      );
    }
  }

  function toggleProvider(type: string) {
    setProviderTypes((current) =>
      current.includes(type)
        ? current.filter((item) => item !== type)
        : [...current, type]
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-accent">
            SkinTwin salon
          </p>
          <h1 className="section-rule text-3xl font-bold">Services</h1>
          <p className="mt-2 max-w-2xl text-subdued">
            Add a service for this salon, then publish it on your storefront.
            Shared treatment rows stay bookable here until you store your own.
          </p>
        </div>
        {booking.services.length > 0 && (
          <Link href="/bookings">
            <Button className="btn-cobalt">
              Schedule {booking.services.length} selected
            </Button>
          </Link>
        )}
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {loading && <p className="text-sm text-subdued">Loading services…</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Container className="space-y-3 border-[color:var(--hairline)]">
          <h2 className="text-lg font-semibold">Storefront address</h2>
          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={claimSlug}
          >
            <Input
              value={slugInput}
              onChange={(event) => setSlugInput(event.target.value)}
              placeholder="your-salon"
              aria-label="Storefront slug"
            />
            <Button className="btn-cobalt" type="submit" disabled={saving}>
              Save slug
            </Button>
          </form>
          {slug && (
            <Link
              className="text-sm font-medium text-accent"
              href={`/store/${slug}`}
            >
              Open /store/{slug}
            </Link>
          )}
        </Container>
        <Container className="space-y-3 border-[color:var(--hairline)]">
          <h2 className="text-lg font-semibold">Add a service</h2>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={createService}>
            <Input
              className="sm:col-span-2"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Service name"
              aria-label="Service name"
              required
            />
            <Input
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="NGN price"
              aria-label="NGN price"
              inputMode="decimal"
              required
            />
            <Input
              value={usdChargeCents}
              onChange={(event) => setUsdChargeCents(event.target.value)}
              placeholder="USD cents"
              aria-label="USD cents"
              inputMode="numeric"
              required
            />
            <Input
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(event.target.value)}
              placeholder="Duration minutes"
              aria-label="Duration minutes"
              inputMode="numeric"
              required
            />
            <div className="flex items-center gap-3 text-sm">
              {PROVIDER_TYPES.map((type) => (
                <label key={type} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={providerTypes.includes(type)}
                    onChange={() => toggleProvider(type)}
                  />
                  {PROVIDER_TYPE_LABELS[type]}
                </label>
              ))}
            </div>
            <Button
              className="btn-cobalt sm:col-span-2"
              type="submit"
              disabled={saving}
            >
              Save service
            </Button>
          </form>
        </Container>
      </div>
      {stored.length > 0 && (
        <Container className="space-y-3 border-[color:var(--hairline)]">
          <h2 className="text-lg font-semibold">Publish</h2>
          <ul className="space-y-2">
            {stored.map((service) => (
              <li
                key={service.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span>{service.name}</span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!slug || saving}
                  onClick={() => setPublished(service, !service.published)}
                >
                  {service.published ? 'Unpublish' : 'Publish'}
                </Button>
              </li>
            ))}
          </ul>
          {!slug && (
            <p className="text-sm text-subdued">
              Save a storefront slug before publishing.
            </p>
          )}
        </Container>
      )}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <ServiceCatalog services={services} mode="book" />
        <div className="xl:sticky xl:top-4 xl:self-start">
          <BookingBasket services={services} />
        </div>
      </div>
    </>
  );
}
