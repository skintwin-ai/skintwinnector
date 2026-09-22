import {NextRequest, NextResponse} from 'next/server';
import {authorizePlatformKey, requireOperatorAccount} from '@/lib/clinicAuth';
import {ingestPlatformRecord} from '@/lib/clinicRecords';

function jsonError(error: string, status: number) {
  return NextResponse.json({error}, {status});
}

export async function POST(req: NextRequest) {
  const platformAuthorized = authorizePlatformKey(
    req.headers.get('authorization')
  );
  const operatorAccountId =
    (await requireOperatorAccount()) ||
    (typeof req.headers.get('x-skintwin-account') === 'string'
      ? req.headers.get('x-skintwin-account')
      : null);

  if (!platformAuthorized && !operatorAccountId) {
    return jsonError('Unauthorized', 401);
  }

  const body = await req.json();
  const action = body?.action;
  if (
    action !== 'sync_appointment' &&
    action !== 'sync_client' &&
    action !== 'sync_certification'
  ) {
    return jsonError('Invalid action', 400);
  }

  try {
    const result = await ingestPlatformRecord({
      source: typeof body.source === 'string' ? body.source : 'skintwin-salon',
      action,
      operatorAccountId:
        (typeof body.operatorAccountId === 'string' &&
          body.operatorAccountId) ||
        operatorAccountId ||
        undefined,
      appointment: body.appointment,
      client: body.client,
      data: body.data,
      certification: body.certification,
    });
    return NextResponse.json(result);
  } catch (error: any) {
    return jsonError(error.message || 'Unable to sync platform record', 400);
  }
}
