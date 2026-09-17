'use client';

import {useMemo, useState} from 'react';
import Link from 'next/link';
import {Clock, Plus, Sparkles} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Badge} from '@/components/ui/badge';
import {Tabs, TabsList, TabsTrigger} from '@/components/ui/tabs';
import Container from '@/app/components/Container';
import {useBooking} from '@/app/contexts/booking/BookingContext';
import type {Service} from '@/app/contexts/booking/types';
import servicesData from '@/app/data/services.json';
import {
  formatCurrency,
  formatDuration,
  getCategoryLabel,
  SERVICE_CATEGORIES,
} from '@/lib/salon';

const services = servicesData as Service[];

type ServiceCatalogProps = {
  mode?: 'book' | 'browse';
  limit?: number;
  hideAddOns?: boolean;
};

const ServiceCatalog = ({
  mode = 'book',
  limit,
  hideAddOns = true,
}: ServiceCatalogProps) => {
  const booking = useBooking();
  const [category, setCategory] = useState<string>('all');

  const filtered = useMemo(() => {
    const byCategory =
      category === 'all'
        ? hideAddOns
          ? services.filter((service) => service.category !== 'add-ons')
          : services
        : services.filter((service) => service.category === category);
    return typeof limit === 'number' ? byCategory.slice(0, limit) : byCategory;
  }, [category, hideAddOns, limit]);

  return (
    <div className="space-y-4">
      <Tabs value={category} onValueChange={setCategory}>
        <TabsList className="h-auto flex-wrap bg-offset">
          {SERVICE_CATEGORIES.filter(
            (item) =>
              !hideAddOns || item !== 'add-ons' || category === 'add-ons'
          ).map((item) => (
            <TabsTrigger
              key={item}
              value={item}
              className="capitalize text-primary data-[state=active]:bg-screen-foreground data-[state=active]:text-accent"
            >
              {item === 'all' ? 'All' : getCategoryLabel(item)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((service) => {
          const selected = booking.services.find(
            (item) => item.serviceId === service.id
          );
          return (
            <Container
              key={service.id}
              className="panel-accent-top flex flex-col gap-4 overflow-hidden border-[color:var(--hairline)] p-0"
            >
              <div className="flex h-28 items-end bg-gradient-to-br from-[#1b6fe5]/40 via-[#0c1a3d] to-[#07112b] px-4 pb-3">
                <div className="bg-accent/20 flex h-10 w-10 items-center justify-center rounded-full text-accent">
                  <Sparkles size={18} />
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-3 px-4 pb-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-subdued">
                      {getCategoryLabel(service.category)}
                    </p>
                    <h3
                      className="text-lg font-semibold text-primary"
                      data-testid="service-name"
                    >
                      {service.name}
                    </h3>
                  </div>
                  {service.requiresConsultation && (
                    <Badge variant="blue">Consult</Badge>
                  )}
                </div>
                <p className="text-sm text-subdued">{service.description}</p>
                <div className="mt-auto flex items-center justify-between gap-3">
                  <div>
                    <p
                      className="font-semibold text-accent"
                      data-testid="service-price"
                    >
                      {formatCurrency(service.price, service.currency)}
                    </p>
                    <p
                      className="flex items-center gap-1 text-xs text-subdued"
                      data-testid="service-duration"
                    >
                      <Clock size={12} />
                      {formatDuration(service.durationMinutes)}
                    </p>
                  </div>
                  {mode === 'book' ? (
                    <Button
                      size="sm"
                      className="btn-cobalt"
                      data-testid={`add-service-${service.id}`}
                      onClick={() => booking.addService(service.id)}
                      aria-label={`Add ${service.name} to booking`}
                    >
                      <Plus size={14} className="mr-1" />
                      {selected ? `Added (${selected.quantity})` : 'Add'}
                    </Button>
                  ) : (
                    <Link href="/login">
                      <Button size="sm" className="btn-cobalt">
                        Book
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </Container>
          );
        })}
      </div>
    </div>
  );
};

export default ServiceCatalog;
