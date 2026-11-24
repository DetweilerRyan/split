import { describe, expect, it } from 'vitest';
import { IdentityModal } from './app/r/[room]/_room-view/IdentityModal';

// The app is built with the React Compiler (next.config.ts), and memoization can change what a
// test sees, so the tests must run through it too. vitest.config.ts adds the compiler to
// plugin-react's Babel plugins; if that line goes, every other test still passes, without it.
describe('vitest.config.ts', () => {
  it('compiles components with the React Compiler, as the app build does', () => {
    // A compiled component starts by allocating its memo cache: `const $ = _c(<slots>)`.
    expect(String(IdentityModal)).toMatch(/const \$ = _c\(\d+\)/);
  });
});
