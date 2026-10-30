import {NextRequest, NextResponse} from 'next/server';
import type {Service} from '@/app/contexts/booking/types';
import {requireOperatorAccount} from '@/lib/clinicAuth';
import {
  createProvisionedService,
  resolveServices,
} from '@/lib/serviceCatalog';

function jsonError(error: string, status: number) {
  return NextResponse.json({error}, {status});
}

const PROVIDER_TYPES = new Set(['esthetician', 'specialist']);

function readCreateBody(
  body: Record<string, unknown>
): {ok: true; service: Service} | {ok: false; error: string} {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return {ok: false, error: 'name is required'};
  }
  if (typeof body.price !== 'number' || !Number.isFinite(body.price)) {
    return {ok: false, error: 'price is required'};
  }
  if (
    typeof body.usdChargeCents !== 'number' ||
    !Number.isInteger(body.usdChargeCents)
  ) {
    return {ok: false, error: 'usdChargeCents is required'};
  }
  if (!Number.isInteger(body.durationMinutes) || body.durationMinutes <= 0) {
    return {ok: false, error: 'durationMinutes must be a positive integer'};
  }
  if (
    !Array.isArray(body.providerTypes) ||
    body.providerTypes.length === 0 ||
    body.providerTypes.some(
      (value) => typeof value !== 'string' || !PROVIDER_TYPES.has(value)
    )
  ) {
    return {ok: false, error: 'providerTypes is required'};
  }

  const id =
    typeof body.id === 'string' && body.id.trim()
      ? body.id.trim()
      : `srv_${crypto.randomUUID()}`;

  return {
    ok: true,
    service: {
      id,
      name,
      category: typeof body.category === 'string' ? body.category : 'custom',
      description:
        typeof body.description === 'string' ? body.description : '',
      durationMinutes: body.durationMinutes,
      bufferMinutes: Number.isInteger(body.bufferMinutes)
        ? body.bufferMinutes
        : 0,
      price: body.price,
      usdChargeCents: body.usdChargeCents,
      currency: typeof body.currency === 'string' ? body.currency : 'NGN',
      providerTypes: body.providerTypes as string[],
      requiresConsultation: Boolean(body.requiresConsultation),
      addOns: Array.isArray(body.addOns)
        ? body.addOns.filter((item): item is string => typeof item === 'string')
        : [],
      image: typeof body.image === 'string' ? body.image : '',
    },
  };
}

export async function GET() {
  const operatorAccountId = await requireOperatorAccount();
  if (!operatorAccountId) {
    return jsonError('Unauthorized or no Stripe account found', 401);
  }
  const services = await resolveServices(operatorAccountId, 'treatment');
  return NextResponse.json({services});
}

export async function POST(req: NextRequest) {
  const operatorAccountId = await requireOperatorAccount();
  if (!operatorAccountId) {
    return jsonError('Unauthorized or no Stripe account found', 401);
  }

  const body = (await req.json()) as Record<string, unknown>;
  const parsed = readCreateBody(body);
  if (!parsed.ok) {
    return jsonError(parsed.error, 400);
  }

  const service = await createProvisionedService({
    ...parsed.service,
    operatorAccountId,
  });
  return NextResponse.json({service});
}
