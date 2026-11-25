// A Vitest setup file, loaded by vitest.config.ts's unit project and by vitest.tooling.config.ts.
// When a soak variable is set, it replaces fast-check's `assert` with scripts/property-soak.ts's
// `soakAssert` for that run. With none set it does nothing, so a normal run, and CI, is untouched.
// docs/testing/property-testing.md says how to run a soak.
import type * as FastCheck from 'fast-check';
import { vi } from 'vitest';

import { readSoak, soakAssert } from './property-soak.ts';

const soak = readSoak(process.env);

if (soak !== undefined) {
  const assert = soakAssert(soak, (line) => {
    console.log(line);
  });
  vi.doMock('fast-check', async (importOriginal) => {
    const actual = await importOriginal<typeof FastCheck>();
    return { ...actual, assert, default: { ...actual.default, assert } };
  });
}
