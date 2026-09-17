'use client';

import {Inter as FontSans} from 'next/font/google';
import {cn} from '@/lib/utils';
import './globals.css';
import NextAuthProvider from './auth';
import DebugMenu from '@/app/components/debug/DebugMenu';
import {SettingsProvider} from '@/app/contexts/settings';
import {EmbeddedComponentBorderProvider} from '@/app/hooks/EmbeddedComponentBorderProvider';
import QueryProvider from '@/app/providers/QueryProvider';
import {useSession} from 'next-auth/react';
import {useEffect} from 'react';
import {DEFAULT_BRAND_NAME} from '@/lib/brand';
import {BookingProvider} from '@/app/contexts/booking/BookingContext';

const fontSans = FontSans({
  subsets: ['latin'],
  variable: '--font-sans',
});

function DynamicTitle() {
  const {data: session} = useSession();

  useEffect(() => {
    const companyName = session?.user?.companyName || DEFAULT_BRAND_NAME;
    document.title =
      companyName === DEFAULT_BRAND_NAME
        ? companyName
        : `(DEMO) ${companyName}`;
  }, [session?.user?.companyName]);

  return null;
}

function DynamicFavicon() {
  const {data: session} = useSession();
  const defaultFavicon = '/favicon.png';

  useEffect(() => {
    const companyLogo = session?.user?.companyLogoUrl;
    const link =
      (document.querySelector("link[rel*='icon']") as HTMLLinkElement) ||
      document.createElement('link');
    link.type = 'image/x-icon';
    link.rel = 'shortcut icon';
    link.href = companyLogo || defaultFavicon;
    document.getElementsByTagName('head')[0].appendChild(link);
  }, [session?.user?.companyLogoUrl]);

  return null;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <title>{DEFAULT_BRAND_NAME}</title>
      </head>
      <body
        className={cn(
          'min-h-screen bg-offset font-sans antialiased',
          fontSans.variable
        )}
      >
        <NextAuthProvider>
          <QueryProvider>
            <DynamicTitle />
            <DynamicFavicon />
            <SettingsProvider>
              <BookingProvider>
                <EmbeddedComponentBorderProvider>
                  {children}
                </EmbeddedComponentBorderProvider>
                <DebugMenu />
              </BookingProvider>
            </SettingsProvider>
          </QueryProvider>
        </NextAuthProvider>
      </body>
    </html>
  );
}
