'use client';

import * as React from 'react';
import {Loader2} from 'lucide-react';
import {generate} from 'random-words';
import {signIn} from 'next-auth/react';
import {ArrowRight} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {useRouter} from 'next/navigation';

const QuickstartButton = () => {
  const [loading, setLoading] = React.useState(false);
  const router = useRouter();

  const CLINIC_NAMES = [
    'RadiantSkinStudio',
    'GlowDermClinic',
    'ClearComplexionCo',
    'LuminousSkinLab',
    'PureGlowAesthetics',
    'VelvetSkinClinic',
    'DewdropDermatology',
    'SilkSkinSanctuary',
    'BrightToneStudio',
    'FreshFaceClinic',
    'SereneSkinCare',
    'CrystalClearSkin',
    'GoldenGlowStudio',
    'PearlSkinClinic',
    'EverglowAesthetics',
    'TrueToneDerm',
    'LushSkinLounge',
    'AquaGlowClinic',
    'BloomSkinStudio',
    'CelestialSkinCare',
    'OpalGlowClinic',
    'PrimeDermStudio',
    'SoftTouchSkin',
    'EliteSkinClinic',
    'VitalGlowAesthetics',
    'NovaSkinStudio',
    'PureRadianceClinic',
    'ZenSkinSanctuary',
    'IvoryGlowDerm',
    'AuraSkinStudio',
    'LuxeDermClinic',
    'ClaritySkinCare',
    'MoonlitSkinLab',
    'RoseGlowClinic',
    'TrueGlowAesthetics',
    'VelvetTouchSkin',
    'CrystalGlowStudio',
    'SeraphicSkinClinic',
    'LusterDermCare',
    'BrightSkinStudio',
  ];

  async function handleQuickstartCreation() {
    setLoading(true);
    const emailNumber = Math.floor(Math.random() * 1001);
    const clinicName =
      CLINIC_NAMES[Math.floor(Math.random() * CLINIC_NAMES.length)];
    const passwordNumber = Math.floor(Math.random() * 90000) + 10000;
    const passwordWords = generate({exactly: 2, minLength: 5, maxLength: 12});

    await signIn('createprefilledaccount', {
      email: `${clinicName}_${emailNumber}@skintwin.ai`,
      password: `${passwordWords[0]}-${passwordWords[1]}-${passwordNumber}`,
      businessName: clinicName,
      callbackUrl: '/home?shownux=true',
    });

    router.push('/home?shownux=true'); // Redirect to the dashboard
  }

  const onClick = async () => {
    try {
      handleQuickstartCreation();
    } catch (error: any) {
      console.error('An error occurred when signing in', error);
    }
  };

  return (
    <Button
      className="items-center gap-2 text-base font-medium"
      onClick={onClick}
      disabled={loading}
    >
      {loading ? (
        <>
          Creating <Loader2 className="animate-spin" size={20} />
        </>
      ) : (
        <>
          Create quickstart account <ArrowRight size={20} />
        </>
      )}
    </Button>
  );
};

export default QuickstartButton;
