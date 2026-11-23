import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULTS } from './config.ts';

// The README lists the config's defaults for people; config.ts owns them, and config.test.ts
// checks the schema. This keeps the README from drifting. oxCrap's behaviour is tested by the
// features in features/, and its modules by their own tests.
describe('README.md', () => {
  it('shows the defaults the code uses', () => {
    const readme = readFileSync(fileURLToPath(new URL('./README.md', import.meta.url)), 'utf8');
    const json = (value: unknown) =>
      JSON.stringify(value).replaceAll(',', ', ').replaceAll(':', ': ');
    expect(readme).toContain(`\`${JSON.stringify(DEFAULTS.files)}\``);
    expect(readme).toContain(
      `\`${JSON.stringify(DEFAULTS.ignorePatterns).replaceAll(',', ', ')}\``,
    );
    expect(readme).toContain(`\`{ ${json(DEFAULTS.limits).slice(1, -1)} }\``);
  });
});
