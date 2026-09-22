import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NextRequest} from 'next/server';

const getServerSession = vi.fn();
const ingestPlatformRecord = vi.fn();

vi.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => getServerSession(...args),
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

vi.mock('@/lib/clinicRecords', () => ({
  ingestPlatformRecord: (...args: unknown[]) => ingestPlatformRecord(...args),
}));

function postRequest(body: unknown, headers?: Record<string, string>) {
  return new NextRequest('http://localhost/api/platform/sync', {
    method: 'POST',
    headers: {'content-type': 'application/json', ...headers},
    body: JSON.stringify(body),
  });
}

describe('POST /api/platform/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SKINTWIN_PLATFORM_KEY = 'platform-secret';
    getServerSession.mockResolvedValue(null);
    ingestPlatformRecord.mockResolvedValue({ok: true, id: 'bkg_1'});
  });

  it('accepts a salon payload with the platform key', async () => {
    const {POST} = await import('./route');
    const response = await POST(
      postRequest(
        {
          action: 'sync_appointment',
          source: 'skintwin-salon',
          data: {externalId: 'apt_1'},
        },
        {authorization: 'Bearer platform-secret'}
      )
    );
    expect(response.status).toBe(200);
    expect(ingestPlatformRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'sync_appointment',
        source: 'skintwin-salon',
        data: {externalId: 'apt_1'},
      })
    );
  });

  it('returns 401 without a session or platform key', async () => {
    const {POST} = await import('./route');
    const response = await POST(
      postRequest({action: 'sync_client', client: {email: 'a@b.com'}})
    );
    expect(response.status).toBe(401);
    expect(ingestPlatformRecord).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid action', async () => {
    const {POST} = await import('./route');
    const response = await POST(
      postRequest(
        {action: 'explode'},
        {authorization: 'Bearer platform-secret'}
      )
    );
    expect(response.status).toBe(400);
  });
});
