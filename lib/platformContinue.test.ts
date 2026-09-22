import {describe, expect, it} from 'vitest';
import {
  isSameOriginContinue,
  resolvePlatformContinue,
  sameOriginPath,
} from './platformContinue';

describe('platform continue', () => {
  it('keeps the LMS hub and rejects foreign hosts', () => {
    expect(
      resolvePlatformContinue(
        'http://localhost:5000/platform',
        'http://localhost:3000'
      )
    ).toBe('http://localhost:5000/platform');
    expect(
      resolvePlatformContinue(
        'https://evil.example/phish',
        'http://localhost:3000'
      )
    ).toBe('http://localhost:3000/home');
  });

  it('treats relative paths as same-origin', () => {
    expect(resolvePlatformContinue('/home', 'http://localhost:3000')).toBe(
      'http://localhost:3000/home'
    );
    expect(
      isSameOriginContinue(
        'http://localhost:3000/home',
        'http://localhost:3000'
      )
    ).toBe(true);
    expect(sameOriginPath('http://localhost:3000/home?x=1')).toBe('/home?x=1');
  });
});
