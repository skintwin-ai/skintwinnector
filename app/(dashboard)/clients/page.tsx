'use client';

import {useEffect, useState} from 'react';
import {Button} from '@/components/ui/button';
import Link from 'next/link';
import Container from '@/app/components/Container';
import type {ClinicClientRecord} from '@/lib/clinicRecords';

import {
  Plus as PlusIcon,
  Phone as PhoneIcon,
  Mail as EmailIcon,
} from 'lucide-react';

function initials(client: ClinicClientRecord) {
  return `${client.firstName?.[0] || ''}${client.lastName?.[0] || ''}`.toUpperCase();
}

export default function Clients() {
  const [clients, setClients] = useState<ClinicClientRecord[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/clients')
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || 'Unable to load clients');
        }
        if (!cancelled) {
          setClients(payload.clients || []);
        }
      })
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
  }, []);

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex-1 text-3xl font-bold">Clients</h1>
          <p className="text-sm text-subdued">
            Clinic clients saved from intake and paid bookings.
          </p>
        </div>
        <Link href="/bookings/intake?standalone=1">
          <Button className="btn-cobalt">
            <PlusIcon size={16} className="mr-1" />
            New intake
          </Button>
        </Link>
      </div>
      {loading && (
        <p className="text-sm text-subdued" data-testid="clients-loading">
          Loading clients…
        </p>
      )}
      {error && (
        <p className="text-sm text-red-400" data-testid="clients-error">
          {error}
        </p>
      )}
      {!loading && !error && clients.length === 0 && (
        <Container className="space-y-3" data-testid="clients-empty">
          <h2 className="text-lg font-semibold">No clients yet</h2>
          <p className="text-sm text-subdued">
            Save a standalone intake or complete a paid booking to start the
            clinic CRM.
          </p>
          <Link href="/bookings/intake?standalone=1">
            <Button className="btn-cobalt">Add the first client</Button>
          </Link>
        </Container>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 md:gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {clients.map((client) => (
          <Container
            className="relative flex flex-col items-center gap-4 overflow-hidden"
            key={client.id}
            data-testid="client-card"
          >
            <div className="flex h-32 w-full items-center justify-center rounded-lg border bg-offset text-3xl font-semibold text-accent md:h-52">
              {initials(client)}
            </div>
            <div className="flex w-full flex-col gap-4 md:flex-row md:items-center">
              <div className="flex-1">
                <h3 className="text-lg font-medium">
                  {client.firstName} {client.lastName}
                </h3>
                <p className="text-sm text-subdued">{client.email}</p>
                <p className="text-sm text-subdued">
                  Updated {new Date(client.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-5">
                <PhoneIcon size={24} color="var(--accent)" />
                <EmailIcon size={24} color="var(--accent)" />
              </div>
            </div>
          </Container>
        ))}
      </div>
    </>
  );
}
