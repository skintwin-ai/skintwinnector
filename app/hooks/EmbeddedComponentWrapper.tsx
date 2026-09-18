'use client';

import {ConnectComponentsProvider} from '@stripe/react-connect-js';
import {EmbeddedComponentProvider} from '@/app/hooks/EmbeddedComponentProvider';
import {useConnect} from '@/app/hooks/useConnect';
import {isUiPreview} from '@/lib/uiPreview';

export const EmbeddedComponentWrapper = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const {hasError, stripeConnectInstance} = useConnect();
  if (hasError || !stripeConnectInstance) {
    if (isUiPreview) {
      return <>{children}</>;
    }
    return null;
  }

  return (
    <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
      <EmbeddedComponentProvider connectInstance={stripeConnectInstance}>
        {children}
      </EmbeddedComponentProvider>
    </ConnectComponentsProvider>
  );
};
