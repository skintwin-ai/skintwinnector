'use client';

import Image from 'next/image';
import Container from '@/app/components/Container';
import SkinTwinLogo from '@/public/skintwin_logo.png';
import Stripe from '@/public/stripe-gray.svg';
import Link from 'next/link';
import {signOut} from 'next-auth/react';
import {useSession} from 'next-auth/react';
import {Button} from '@/components/ui/button';
import {hasCustomBranding} from '@/lib/utils';
import {SettingsContext} from '../contexts/settings';
import {useContext} from 'react';
import {DEFAULT_BRAND_NAME} from '@/lib/brand';
import ThemeToggle from '@/app/components/skintwin/ThemeToggle';

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const {data, status} = useSession();
  const settings = useContext(SettingsContext);
  const hasCustomBrandingValues = hasCustomBranding(settings);

  const SignOut = () => {
    if (status == 'unauthenticated') {
      return;
    }

    return (
      <p className="text-center text-sm text-secondary">
        Signed in as <span className="font-medium">{data?.user?.email}</span>.{' '}
        <Button
          variant="link"
          className="border-primary/20 rounded-none border-b p-0 text-sm text-secondary"
          onClick={() => signOut({callbackUrl: '/'})}
        >
          Sign out
        </Button>
      </p>
    );
  };

  return (
    <div
      className={`min-h-screen bg-screen-background ${hasCustomBrandingValues ? 'bg-screen-custom' : ''} py-4 sm:py-16`}
    >
      <div className="mx-auto flex max-w-[450px] flex-col gap-6 p-3 sm:gap-6">
        <div className="mb-6 flex w-full items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-4 text-3xl font-bold text-primary">
              <Image
                src={data?.user?.companyLogoUrl || SkinTwinLogo}
                alt={`${data?.user?.companyName || DEFAULT_BRAND_NAME} Logo`}
                className="h-12 w-12 sm:h-16 sm:w-16"
                width={40}
                height={40}
              />
              {data?.user?.companyName || DEFAULT_BRAND_NAME}
            </div>
          </Link>
          <ThemeToggle />
        </div>
        <Container className="no-scrollbar w-full rounded-xl px-5 py-5">
          {children}
        </Container>
        <SignOut />
        <div className="mt-8 flex w-full flex-col items-center gap-2">
          <a href="https://stripe.com" target="_blank">
            <Image src={Stripe} alt="stripe logo" height={24} />
          </a>
          <p className="text-center text-sm text-subdued">
            This site is a demo for{' '}
            <a
              className="border-primary/20 hover:border-primary/70 border-b font-medium"
              href="https://docs.stripe.com/connect/get-started-connect-embedded-components"
              target="_blank"
            >
              Stripe Connect embedded components
            </a>
            . SkinTwin is not a real product.
          </p>
        </div>
      </div>
    </div>
  );
}
