import {afterEach, describe, expect, it, vi} from 'vitest';

const {connect} = vi.hoisted(() => ({connect: vi.fn()}));

vi.mock('mongoose', () => ({
  default: {connect},
}));

describe('dbConnect', () => {
  afterEach(() => {
    vi.resetModules();
    connect.mockReset();
    global.mongoose = undefined;
  });

  it('does not leave an unhandled rejection when connect fails', async () => {
    process.env.MONGO_URI = 'mongodb://127.0.0.1:59999/skintwin';
    connect.mockRejectedValueOnce(new Error('down'));
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    try {
      const {default: dbConnect} = await import('./dbConnect');
      await expect(dbConnect()).rejects.toThrow('down');
      await new Promise((resolve) => setImmediate(resolve));
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});
