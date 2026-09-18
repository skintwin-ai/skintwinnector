import {NextRequest, NextResponse} from 'next/server';
import nextAuthMiddleware from 'next-auth/middleware';
import {isUiPreview} from '@/lib/uiPreview';

export default function middleware(req: NextRequest, ev: unknown) {
  if (isUiPreview) {
    return NextResponse.next();
  }

  return (
    nextAuthMiddleware as (request: NextRequest, event: unknown) => unknown
  )(req, ev);
}

export const config = {
  matcher: [
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
