import {NextRequest, NextResponse} from 'next/server';
import {requireOperatorAccount} from '@/lib/clinicAuth';
import {
  claimSalonSlug,
  releaseSalonSlug,
  slugForAccount,
} from '@/lib/serviceCatalog';

function jsonError(error: string, status: number) {
  return NextResponse.json({error}, {status});
}

export async function GET() {
  const operatorAccountId = await requireOperatorAccount();
  if (!operatorAccountId) {
    return jsonError('Unauthorized or no Stripe account found', 401);
  }
  return NextResponse.json({
    slug: await slugForAccount(operatorAccountId),
  });
}

export async function POST(req: NextRequest) {
  const operatorAccountId = await requireOperatorAccount();
  if (!operatorAccountId) {
    return jsonError('Unauthorized or no Stripe account found', 401);
  }

  const body = (await req.json()) as {slug?: unknown};
  const claimed = claimSalonSlug(operatorAccountId, body?.slug);
  if (!claimed.ok) {
    return jsonError(claimed.error, 409);
  }

  const {default: Salon} = await import('@/app/models/salon');
  const salon = await Salon.findOne({stripeAccountId: operatorAccountId});
  if (!salon) {
    releaseSalonSlug(operatorAccountId);
    return jsonError('Salon not found', 404);
  }

  const previous = typeof salon.slug === 'string' ? salon.slug : undefined;
  salon.slug = claimed.slug;
  try {
    await salon.save();
  } catch (error) {
    if (previous) {
      claimSalonSlug(operatorAccountId, previous);
    } else {
      releaseSalonSlug(operatorAccountId);
    }
    console.warn('Salon slug save failed', error);
    return jsonError('Slug is already taken', 409);
  }

  return NextResponse.json({slug: claimed.slug});
}
