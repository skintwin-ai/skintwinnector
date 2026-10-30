import {NextRequest, NextResponse} from 'next/server';
import type {Service} from '@/app/contexts/booking/types';
import {requireOperatorAccount} from '@/lib/clinicAuth';
import {isProviderTypeList} from '@/lib/providerTypes';
import {
  CatalogMirrorError,
  updateProvisionedService,
} from '@/lib/serviceCatalog';

function jsonError(error: string, status: number) {
  return NextResponse.json({error}, {status});
}

function readPatch(
  body: Record<string, unknown>
):
  | {ok: true; patch: Partial<Service> & {published?: boolean}}
  | {ok: false; error: string} {
  const patch: Partial<Service> & {published?: boolean} = {};
  if (typeof body.name === 'string') {
    const name = body.name.trim();
    if (!name) {
      return {ok: false, error: 'name is required'};
    }
    patch.name = name;
  }
  if (body.price !== undefined) {
    if (typeof body.price !== 'number' || !Number.isFinite(body.price)) {
      return {ok: false, error: 'price is required'};
    }
    patch.price = body.price;
  }
  if (body.usdChargeCents !== undefined) {
    if (
      typeof body.usdChargeCents !== 'number' ||
      !Number.isInteger(body.usdChargeCents)
    ) {
      return {ok: false, error: 'usdChargeCents is required'};
    }
    patch.usdChargeCents = body.usdChargeCents;
  }
  if (body.durationMinutes !== undefined) {
    const durationMinutes = body.durationMinutes;
    if (
      !Number.isInteger(durationMinutes) ||
      (durationMinutes as number) <= 0
    ) {
      return {ok: false, error: 'durationMinutes must be a positive integer'};
    }
    patch.durationMinutes = durationMinutes as number;
  }
  if (body.providerTypes !== undefined) {
    if (!isProviderTypeList(body.providerTypes)) {
      return {ok: false, error: 'providerTypes is required'};
    }
    patch.providerTypes = body.providerTypes;
  }
  if (body.published !== undefined) {
    if (typeof body.published !== 'boolean') {
      return {ok: false, error: 'published must be true or false'};
    }
    patch.published = body.published;
  }
  if (typeof body.description === 'string') {
    patch.description = body.description;
  }
  if (typeof body.category === 'string') {
    patch.category = body.category;
  }
  if (Array.isArray(body.addOns)) {
    patch.addOns = body.addOns.filter(
      (item): item is string => typeof item === 'string'
    );
  }
  return {ok: true, patch};
}

export async function PATCH(
  req: NextRequest,
  {params}: {params: {serviceId: string}}
) {
  const operatorAccountId = await requireOperatorAccount();
  if (!operatorAccountId) {
    return jsonError('Unauthorized or no Stripe account found', 401);
  }

  const body = (await req.json()) as Record<string, unknown>;
  const parsed = readPatch(body);
  if (!parsed.ok) {
    return jsonError(parsed.error, 400);
  }

  try {
    const service = await updateProvisionedService(
      operatorAccountId,
      params.serviceId,
      parsed.patch
    );
    if (!service) {
      return jsonError('Service not found', 404);
    }
    return NextResponse.json({service});
  } catch (error) {
    if (error instanceof CatalogMirrorError) {
      return jsonError(error.message, 500);
    }
    throw error;
  }
}
