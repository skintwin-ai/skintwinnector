import {NextRequest, NextResponse} from 'next/server';
import {requireOperatorAccount} from '@/lib/clinicAuth';
import {listClinicClients, upsertClinicClient} from '@/lib/clinicRecords';

function jsonError(error: string, status: number) {
  return NextResponse.json({error}, {status});
}

export async function GET() {
  const operatorAccountId = await requireOperatorAccount();
  if (!operatorAccountId) {
    return jsonError('Unauthorized or no Stripe account found', 401);
  }
  const clients = await listClinicClients(operatorAccountId);
  return NextResponse.json({clients});
}

export async function POST(req: NextRequest) {
  const operatorAccountId = await requireOperatorAccount();
  if (!operatorAccountId) {
    return jsonError('Unauthorized or no Stripe account found', 401);
  }

  const body = await req.json();
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  if (!email) {
    return jsonError('Client email is required', 400);
  }

  const client = await upsertClinicClient({
    operatorAccountId,
    client: {
      firstName: typeof body.firstName === 'string' ? body.firstName : '',
      lastName: typeof body.lastName === 'string' ? body.lastName : '',
      email,
      phone: typeof body.phone === 'string' ? body.phone : '',
      consentAccepted: Boolean(body.consentAccepted),
      intakeCompleted: Boolean(body.intakeCompleted ?? true),
    },
  });

  return NextResponse.json({client});
}
