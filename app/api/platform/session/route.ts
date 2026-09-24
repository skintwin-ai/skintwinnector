import {NextRequest, NextResponse} from 'next/server';
import {requireOperatorAccount} from '@/lib/clinicAuth';
import {
  issuePlatformSession,
  verifyPlatformSession,
} from '@/lib/platformSession';

function jsonError(error: string, status: number) {
  return NextResponse.json({error}, {status});
}

export async function GET(req: NextRequest) {
  const actor = verifyPlatformSession(req.headers.get('authorization'));
  if (!actor) {
    return jsonError('Unauthorized', 401);
  }
  return NextResponse.json({ok: true, actor});
}

export async function POST(req: NextRequest) {
  const actor =
    verifyPlatformSession(req.headers.get('authorization')) ||
    ((await requireOperatorAccount())
      ? {
          email: 'operator@skintwin.ai',
          name: 'Clinic Operator',
          role: 'operator' as const,
          source: 'skintwinnector',
        }
      : null);

  if (!actor) {
    return jsonError('Unauthorized', 401);
  }

  try {
    const token = issuePlatformSession(actor);
    return NextResponse.json({ok: true, actor, platformSession: token});
  } catch (error: any) {
    return jsonError(error.message || 'Unable to issue platform session', 500);
  }
}
