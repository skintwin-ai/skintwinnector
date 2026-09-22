import {NextRequest, NextResponse} from 'next/server';
import {requireOperatorAccount} from '@/lib/clinicAuth';
import {getClinicOverview, listClinicBookings} from '@/lib/clinicRecords';

function jsonError(error: string, status: number) {
  return NextResponse.json({error}, {status});
}

export async function GET(req: NextRequest) {
  const operatorAccountId = await requireOperatorAccount();
  if (!operatorAccountId) {
    return jsonError('Unauthorized or no Stripe account found', 401);
  }

  if (req.nextUrl.searchParams.get('overview') === '1') {
    const overview = await getClinicOverview(operatorAccountId);
    return NextResponse.json({overview});
  }

  const date = req.nextUrl.searchParams.get('date') || undefined;
  const bookings = await listClinicBookings({operatorAccountId, date});
  return NextResponse.json({bookings});
}
