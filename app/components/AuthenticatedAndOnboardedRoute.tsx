'use client';

import {useSession} from 'next-auth/react';
import {useRouter} from 'next/navigation';
import {useEffect} from 'react';
import {LoaderCircle} from 'lucide-react';
import {useGetStripeAccount} from '../hooks/useGetStripeAccount';
import {isUiPreview} from '@/lib/uiPreview';

const LoadingView = () => {
  return (
    <div className="h-64 content-center">
      <LoaderCircle className="mx-auto animate-spin" size={30} />
    </div>
  );
};

const RedirectToOnboarding = () => {
  const router = useRouter();

  useEffect(() => {
    router.push('/onboarding');
  }, [router]);

  return <LoadingView />;
};

export default function AuthenticatedAndOnboardedRoute({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const {data: session, status} = useSession();
  const {stripeAccount, loading} = useGetStripeAccount();

  if (isUiPreview) {
    return <>{children}</>;
  }

  const isLoading = !session || !session.user || loading;
  const shouldRedirect = !stripeAccount?.details_submitted;

  if (isLoading) {
    return <LoadingView />;
  } else if (shouldRedirect) {
    return <RedirectToOnboarding />;
  }

  return <>{children}</>;
}
