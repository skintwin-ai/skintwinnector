import {afterEach, describe, expect, it} from 'vitest';
import {
  issuePlatformSession,
  operatorFromPlatformActor,
  verifyPlatformSession,
} from './platformSession';

describe('platform session', () => {
  afterEach(() => {
    delete process.env.SKINTWIN_PLATFORM_KEY;
  });

  it('issues a token the same secret can verify', () => {
    process.env.SKINTWIN_PLATFORM_KEY = 'mesh-secret';
    const token = issuePlatformSession({
      email: 'Demo@SkinTwin.AI',
      name: 'Demo Therapist',
      role: 'therapist',
      source: 'regima-training-lms',
    });
    expect(token.startsWith('stsess.')).toBe(true);
    expect(verifyPlatformSession(`Bearer ${token}`)).toEqual({
      email: 'demo@skintwin.ai',
      name: 'Demo Therapist',
      role: 'therapist',
      source: 'regima-training-lms',
    });
  });

  it('accepts the raw platform key as a machine actor', () => {
    process.env.SKINTWIN_PLATFORM_KEY = 'mesh-secret';
    expect(verifyPlatformSession('Bearer mesh-secret')?.email).toBe(
      'platform@skintwin.ai'
    );
  });

  it('builds a Connect operator from the actor', () => {
    expect(
      operatorFromPlatformActor({
        email: 'demo@skintwin.ai',
        name: 'Dr. Jane Doe',
        role: 'therapist',
        source: 'regima-training-lms',
      })
    ).toMatchObject({
      id: 'platform:demo@skintwin.ai',
      email: 'demo@skintwin.ai',
      companyName: 'Dr. Jane Doe',
    });
  });

  it('rejects a token signed with another secret', () => {
    process.env.SKINTWIN_PLATFORM_KEY = 'mesh-secret';
    const token = issuePlatformSession({
      email: 'ada@skintwin.ai',
      name: 'Ada',
      role: 'therapist',
      source: 'regima-training-lms',
    });
    process.env.SKINTWIN_PLATFORM_KEY = 'other-secret';
    expect(verifyPlatformSession(token)).toBeNull();
  });
});
