'use client';
import React from 'react';
import Schedule from '@/app/components/Schedule';
import MonthToDateWidget from '@/app/components/MonthToDateWidget';
import CustomersWidget from '@/app/components/CustomersWidget';
import EmbeddedComponentContainer from '@/app/components/EmbeddedComponentContainer';
import {
  ConnectNotificationBanner,
  ConnectBalances,
} from '@stripe/react-connect-js';
import {useSession} from 'next-auth/react';
import {redirect} from 'next/navigation';
import Container from '@/app/components/Container';
import {CapitalFinancingPromotionSection} from '@/app/components/CapitalFinancingPromotionSection';
import {useGetStripeAccount} from '@/app/hooks/useGetStripeAccount';
import Link from 'next/link';
import {Button} from '@/components/ui/button';
import ServiceCatalog from '@/app/components/skintwin/ServiceCatalog';
import {isUiPreview} from '@/lib/uiPreview';

export default function Dashboard() {
  const {data: session} = useSession();
  if (!session && !isUiPreview) {
    redirect('/');
  }
  const {stripeAccount} = useGetStripeAccount();

  const BREAKPOINT = 1190;
  const [showBanner, setShowBanner] = React.useState(false);

  const renderConditionallyCallback = (response: {
    total: number;
    actionRequired: number;
  }) => {
    if (response && response.total > 0) {
      setShowBanner(true);
    } else {
      setShowBanner(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-3xl font-bold" data-testid="title-header">
          Welcome back, {stripeAccount?.individual?.first_name || 'clinician'}
        </h1>
        <Link href="/services">
          <Button className="btn-cobalt">Book a treatment</Button>
        </Link>
      </div>
      <div className={`${showBanner ? 'flex' : 'hidden'} flex-col`}>
        <EmbeddedComponentContainer
          componentName="NotificationBanner"
          className="overflow-hidden rounded-lg px-0 py-0 pb-1"
        >
          <ConnectNotificationBanner
            onNotificationsChange={renderConditionallyCallback}
          />
        </EmbeddedComponentContainer>
      </div>
      <div className="flex flex-col items-start gap-2 md:gap-5 xl:flex-row">
        <Container className="flex w-full flex-1 flex-col p-5">
          <Schedule />
        </Container>
        <div className="-order-1 flex w-full min-w-[370px] flex-col gap-2 md:gap-4 xl:order-2 xl:w-[30%]">
          <div className="flex flex-grow flex-col gap-2 md:gap-4 md:max-xl:flex-row">
            <Container className="flex-grow px-3 pt-3">
              <EmbeddedComponentContainer componentName="Balances">
                <ConnectBalances />
              </EmbeddedComponentContainer>
            </Container>
            <CapitalFinancingPromotionSection
              layout="banner"
              className="w-full px-5"
            />
          </div>
          <h2 className="hidden pt-4 text-lg font-bold xl:block">
            Performance
          </h2>
          <div className="flex flex-grow flex-col gap-2 md:gap-4 md:max-xl:flex-row">
            <MonthToDateWidget />
            <CustomersWidget />
          </div>
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">SkinTwin treatments</h2>
            <p className="text-sm text-subdued">
              Featured salon services available to book from this clinic.
            </p>
          </div>
          <Link href="/services" className="text-sm font-medium text-accent">
            View catalog
          </Link>
        </div>
        <ServiceCatalog mode="book" limit={3} />
      </div>
    </>
  );
}
