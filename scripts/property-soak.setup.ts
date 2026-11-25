// A Vitest setup file. When a soak variable is set, it applies property-soak.ts's settings and
// plugins through fast-check's global configuration for that run. With none set it does nothing,
// so a normal run is untouched. How to use it is in property-soak.md beside this file.
import fc from 'fast-check';

import { readSoak, soakPlugins, soakSettings } from './property-soak.ts';

const soak = readSoak(process.env);

// Marks the plugins installed, since fast-check's global plugins outlive this file when Vitest
// runs several test files in one module graph (isolate: false), and installing them twice would
// double the time limit and the log.
const installed = Symbol.for('property-soak.installed');

if (soak !== undefined) {
  fc.configureGlobal({ ...fc.readConfigureGlobal(), ...soakSettings(soak) });
  if (Reflect.get(globalThis, installed) !== true) {
    for (const plugin of soakPlugins(soak, (line) => {
      console.log(line);
    })) {
      fc.installGlobalPlugin(plugin);
    }
    Reflect.set(globalThis, installed, true);
  }
}
