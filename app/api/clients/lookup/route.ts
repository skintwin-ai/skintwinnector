import {NextRequest, NextResponse} from 'next/server';
import {requireOperatorAccount} from '@/lib/clinicAuth';
import {lookupClinicClient} from '@/lib/clinicRecords';

function jsonError(error: string, status: number) {
  return NextResponse.json({error}, {status});
}

export async function GET(req: NextRequest) {
  const operatorAccountId = await requireOperatorAccount();
  if (!operatorAccountId) {
    return jsonError('Unauthorized or no Stripe account found', 401);
  }

  const email = req.nextUrl.searchParams.get('email') || '';
  if (!email.includes('@')) {
    return jsonError('A valid email is required', 400);
  }

  const client = await lookupClinicClient(operatorAccountId, email);
  if (!client) {
    return jsonError('No client found with this email', 404);
  }

  return NextResponse.json({client});
}
