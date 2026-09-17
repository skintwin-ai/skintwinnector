export {default} from 'next-auth/middleware';

export const config = {
  // specify the route you want to protect
  matcher:
    process.env.NEXT_PUBLIC_UI_PREVIEW === '1'
      ? []
      : [
          '/home',
          '/services',
          '/bookings',
          '/bookings/:path*',
          '/clients',
          '/payments',
          '/payouts',
          '/reports',
          '/finances',
          '/finances/cards',
          '/finances/financing',
          '/settings',
          '/settings/:path*',
        ],
};
