import {Button} from '@/components/ui/button';
import Image from 'next/image';
import Link from 'next/link';
import Container from '@/app/components/Container';
import clients from '@/app/data/clients.json';

import {
  Plus as PlusIcon,
  Phone as PhoneIcon,
  Mail as EmailIcon,
} from 'lucide-react';

const shuffle = (array: object[]) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]; // Swap elements
  }
  return array;
};

export default function Clients() {
  shuffle(clients);

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex-1 text-3xl font-bold">Clients</h1>
          <p className="text-sm text-subdued">
            Clinic clients and intake records. Book a SkinTwin treatment from
            the catalog.
          </p>
        </div>
        <Link href="/bookings/intake?standalone=1">
          <Button className="btn-cobalt">
            <PlusIcon size={16} className="mr-1" />
            New intake
          </Button>
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 md:gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {clients.map((client, key) => {
          return (
            <Container
              className="relative flex cursor-pointer flex-col items-center gap-4 overflow-hidden transition duration-200 hover:scale-[1.01] hover:shadow-lg"
              key={key}
            >
              <Image
                className="relative h-32 w-full rounded-lg border object-cover md:h-52"
                fill
                quality={80}
                src={`/client_photos/${client.profilePhoto}.jpg`}
                sizes="(max-width: 768px) 50vw, 400px"
                alt={`Photo of ${client.name}`}
                priority
              />
              <div className="flex w-full flex-col gap-4 md:flex-row md:items-center">
                <div className="flex-1">
                  <h3 className="text-lg font-medium">{client.name}</h3>
                  <p className="text-sm text-subdued">Joined {client.date}</p>
                </div>
                <div className="flex gap-5">
                  <PhoneIcon size={24} color="var(--accent)" />
                  <EmailIcon size={24} color="var(--accent)" />
                </div>
              </div>
            </Container>
          );
        })}
      </div>
    </>
  );
}
