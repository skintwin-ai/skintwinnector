import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NextRequest} from 'next/server';

const getServerSession = vi.fn();

vi.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => getServerSession(...args),
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

describe('GET /api/platform/session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SKINTWIN_PLATFORM_KEY = 'mesh-secret';
    getServerSession.mockResolvedValue(null);
  });

  it('verifies a signed platform session', async () => {
    const {issuePlatformSession} = await import('@/lib/platformSession');
    const {GET} = await import('./route');
    const token = issuePlatformSession({
      email: 'demo@skintwin.ai',
      name: 'Demo',
      role: 'therapist',
      source: 'regima-training-lms',
    });
    const response = await GET(
      new NextRequest('http://localhost/api/platform/session', {
        headers: {authorization: `Bearer ${token}`},
      })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      actor: {email: 'demo@skintwin.ai'},
    });
  });
});
