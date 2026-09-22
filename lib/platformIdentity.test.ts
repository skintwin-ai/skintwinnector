import {describe, expect, it} from 'vitest';
import {canonicalEmail, emailFromUsername} from './platformIdentity';

describe('platform identity', () => {
  it('canonicalizes emails and maps usernames onto @skintwin.ai', () => {
    expect(canonicalEmail(' Demo@SkinTwin.AI ')).toBe('demo@skintwin.ai');
    expect(emailFromUsername('demo')).toBe('demo@skintwin.ai');
    expect(emailFromUsername('Adaeze.Obi@Example.com')).toBe(
      'adaeze.obi@example.com'
    );
  });
});
