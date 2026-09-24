import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import mongoose from 'mongoose';

vi.mock('mongoose', () => ({
  default: {connect: vi.fn()},
}));

describe('dbConnect', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mocked(mongoose.connect).mockReset();
    global.mongoose = {conn: null, promise: null};
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.mongoose = undefined;
  });

  it('clears a failed connection and allows a successful retry', async () => {
    const error = new Error('MongoDB unavailable');
    vi.mocked(mongoose.connect)
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(mongoose);
    const {default: dbConnect} = await import('./dbConnect');

    await expect(dbConnect()).rejects.toBe(error);
    expect(global.mongoose.conn).toBeNull();
    expect(global.mongoose.promise).toBeNull();

    await expect(dbConnect()).resolves.toBe(mongoose);
    expect(mongoose.connect).toHaveBeenCalledTimes(2);
    expect(global.mongoose.conn).toBe(mongoose);
  });

  it('reuses a successful connection', async () => {
    vi.mocked(mongoose.connect).mockResolvedValueOnce(mongoose);
    const {default: dbConnect} = await import('./dbConnect');

    await expect(dbConnect()).resolves.toBe(mongoose);
    await expect(dbConnect()).resolves.toBe(mongoose);
    expect(mongoose.connect).toHaveBeenCalledTimes(1);
  });

  it('shares a pending connection between concurrent callers', async () => {
    vi.mocked(mongoose.connect).mockResolvedValueOnce(mongoose);
    const {default: dbConnect} = await import('./dbConnect');

    await expect(Promise.all([dbConnect(), dbConnect()])).resolves.toEqual([
      mongoose,
      mongoose,
    ]);
    expect(mongoose.connect).toHaveBeenCalledTimes(1);
  });
});
