export {default} from 'next-auth/middleware';

export const config = {
  // specify the route you want to protect
  matcher: [
    '/home',
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
