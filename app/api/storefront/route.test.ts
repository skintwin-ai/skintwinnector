import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NextRequest} from 'next/server';
import {
  resetServiceCatalogForTests,
  slugForAccount,
} from '@/lib/serviceCatalog';

const getServerSession = vi.fn();
const save = vi.hoisted(() => vi.fn());
const findOne = vi.hoisted(() => vi.fn());

vi.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => getServerSession(...args),
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

vi.mock('@/lib/dbConnect', () => ({
  default: vi.fn().mockRejectedValue(new Error('no mongo in unit tests')),
}));

vi.mock('@/app/models/salon', () => ({
  default: {
    findOne: (...args: unknown[]) => findOne(...args),
  },
}));

function postSlug(slug: string) {
  return new NextRequest('http://localhost/api/storefront', {
    method: 'POST',
    body: JSON.stringify({slug}),
  });
}

describe('POST /api/storefront', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetServiceCatalogForTests();
    save.mockResolvedValue(undefined);
    findOne.mockImplementation(async () => ({save}));
    getServerSession.mockResolvedValue({
      user: {stripeAccountId: 'acct_ada'},
    });
  });

  it('stores a lowercased slug and rejects the same slug from another account', async () => {
    const {POST} = await import('./route');
    const first = await POST(postSlug('Ada'));

    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({slug: 'ada'});
    expect(slugForAccount('acct_ada')).toBe('ada');
    expect(save).toHaveBeenCalled();

    getServerSession.mockResolvedValue({
      user: {stripeAccountId: 'acct_other'},
    });
    const second = await POST(postSlug('Ada'));

    expect(second.status).toBeGreaterThanOrEqual(400);
    expect(slugForAccount('acct_ada')).toBe('ada');
    expect(slugForAccount('acct_other')).toBeNull();
  });
});
