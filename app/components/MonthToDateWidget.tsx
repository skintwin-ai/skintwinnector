'use client';

import React, {useContext, useEffect, useState} from 'react';
import Container from './Container';
import {Badge} from '@/components/ui/badge';
import {SparkLineChart} from '@mui/x-charts/SparkLineChart';
import {calculateSecondaryColor} from '@/lib/utils';
import {SettingsContext} from '../contexts/settings';
import {defaultPrimaryColor} from '../contexts/themes/ThemeConstants';
import type {ClinicOverview} from '@/lib/clinicRecords';

const MonthToDateWidget = () => {
  const {primaryColor} = useContext(SettingsContext);
  const [overview, setOverview] = useState<ClinicOverview | null>(null);
  const secondaryColor = calculateSecondaryColor(
    primaryColor || defaultPrimaryColor,
    {
      opacity: 0.25,
      darkenAmount: 0.1,
    }
  );

  useEffect(() => {
    fetch('/api/bookings?overview=1')
      .then((response) => response.json())
      .then((payload) => setOverview(payload.overview || null))
      .catch(() => setOverview(null));
  }, []);

  const amount = ((overview?.monthToDateCents || 0) / 100).toLocaleString(
    'en-US',
    {
      style: 'currency',
      currency: (overview?.monthToDateCurrency || 'usd').toUpperCase(),
    }
  );

  return (
    <Container className="w-full px-5">
      <div className="flex flex-row justify-between gap-6">
        <div className="min-w-[110px] space-y-1">
          <h1 className="font-bold text-subdued">Month-to-date</h1>
          <div className="flex flex-row items-center space-x-2">
            <div className="text-xl font-bold" data-testid="mtd-amount">
              {amount}
            </div>
            <Badge className="h-6 rounded-md border-success-border bg-success px-1 py-0 text-success-foreground">
              {overview?.paidBookingCount || 0} paid
            </Badge>
          </div>
        </div>
        <div className="relative w-full">
          <div className="absolute right-0 w-full max-w-[250px]">
            <SparkLineChart
              data={
                overview?.sparkline?.length ? overview.sparkline : [0, 0, 0, 0]
              }
              height={55}
              colors={[secondaryColor]}
              curve="natural"
              className="right-0 w-full"
            />
          </div>
          <div className="absolute right-0 w-full max-w-[250px]">
            <SparkLineChart
              data={
                overview?.sparkline?.length ? overview.sparkline : [0, 1, 0, 1]
              }
              height={55}
              colors={['var(--accent)']}
              curve="natural"
              className="right-0 w-full"
            />
          </div>
        </div>
      </div>
    </Container>
  );
};

export default MonthToDateWidget;
