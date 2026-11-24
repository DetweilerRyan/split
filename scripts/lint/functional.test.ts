import { RuleTester } from 'oxlint/plugins-dev';
import { describe, expect, it } from 'vitest';
import plugin, { noClasses, noThis } from './functional.ts';

// oxlint's RuleTester parses each case with oxlint's own parser, in this process, and runs the
// rule's visitors on it. It reports through the test runner it's given.
RuleTester.describe = describe;
RuleTester.it = it;
const tester = new RuleTester({ languageOptions: { parserOptions: { lang: 'ts' } } });

describe('the functional plugin', () => {
  it('is named functional, so its rules are functional/no-classes and functional/no-this', () => {
    expect(plugin.meta.name).toBe('functional');
    expect(plugin.rules).toEqual({ 'no-classes': noClasses, 'no-this': noThis });
  });
});

tester.run('no-classes', noClasses, {
  valid: [
    'class NotFound extends Error {}',
    'class Refused extends RangeError {}',
    'const Failed = class extends TypeError {};',
    'class Unreadable extends errors.ConfigError {}',
    'function make() { return { name: "class" }; }',
    'const klass = 1; const className = "row";',
  ],
  invalid: [
    {
      code: 'class Store {}',
      errors: [
        {
          message:
            'Write functions over plain data, or a factory that closes over its state, not a class: functions over stateful classes, as the owner decided on DetweilerRyan/split#81. Only an Error subclass may be a class.',
          line: 1,
        },
      ],
    },
    { code: 'export class Store {}', errors: [{ messageId: 'noClasses', line: 1 }] },
    { code: 'export default class {}', errors: [{ messageId: 'noClasses', line: 1 }] },
    { code: 'const Store = class {};', errors: [{ messageId: 'noClasses', line: 1 }] },
    { code: 'use(class {});', errors: [{ messageId: 'noClasses', line: 1 }] },
    { code: 'class Base {}\nclass Store extends Base {}', errors: 2 },
    { code: 'class Store extends Errors {}', errors: [{ messageId: 'noClasses' }] },
    { code: 'class Store extends ErrorLike {}', errors: [{ messageId: 'noClasses' }] },
    { code: 'class Store extends errors["Error"] {}', errors: [{ messageId: 'noClasses' }] },
    { code: 'class Store extends errors[StoreError] {}', errors: [{ messageId: 'noClasses' }] },
    { code: 'class Store extends mixin(Error) {}', errors: [{ messageId: 'noClasses' }] },
    { code: 'abstract class Store {}', errors: [{ messageId: 'noClasses' }] },
    {
      code: 'class NotFound extends Error {\n  static Inner = class {};\n}',
      errors: [{ messageId: 'noClasses', line: 2 }],
    },
  ],
});

tester.run('no-this', noThis, {
  valid: [
    'function f(self: { x: number }) { return self.x; }',
    'const g = globalThis;',
    'function f(this: Window) {}',
    'interface Chain { next(): this }',
    'type T = { m(): typeof this };',
    'function f(this: A, y: typeof this.x) {}',
    'function g(this: A, y: typeof this.x.y) {}',
    'const text = "this";',
    'const thisOne = 1;',
  ],
  invalid: [
    {
      code: 'function f() { return this; }',
      errors: [
        {
          message:
            'Take what a function needs as a parameter, or close over it, rather than reading `this`: functions over stateful classes, as the owner decided on DetweilerRyan/split#81.',
          line: 1,
        },
      ],
    },
    { code: 'const read = () => this.value;', errors: [{ messageId: 'noThis' }] },
    { code: 'const o = { m() { return this.x + this.y; } };', errors: 2 },
    {
      code: 'class NotFound extends Error {\n  constructor() {\n    super();\n    this.name = "NotFound";\n  }\n}',
      errors: [{ messageId: 'noThis', line: 4 }],
    },
    { code: 'this;', errors: [{ messageId: 'noThis' }] },
  ],
});

const inClasses = [{ allowInClasses: true }];

tester.run('no-this, with allowInClasses', noThis, {
  valid: [
    'class S { m() { return this.x; } }',
    'class S { constructor() { this.x = 1; } }',
    'class S { get x() { return this.y; } set x(v) { this.y = v; } }',
    'class S { static make() { return new this(); } }',
    'class S { #read() { return this.x; } }',
    'class S { x = this.y; }',
    'class S { read = () => this.x; }',
    'class S { static { this.count = 0; } }',
    'class S { accessor x = this.y; }',
    'class S { m() { return items.map((i) => this.f(i)); } }',
    'const S = class { m() { return this; } };',
    'class NotFound extends Error { constructor() { super(); this.name = "NotFound"; } }',
    'class Outer { m() { return class { n() { return this; } }; } }',
  ].map((code) => ({ code, options: inClasses })),
  invalid: [
    'function f() { return this; }',
    'const read = () => this.value;',
    'this;',
    'const o = { m() { return this.x; } };',
    'class S { m() { return function () { return this; }; } }',
    'class S { m() { function inner() { return this; } } }',
    'class S { [this.key]() {} }',
    'class S { [this.key] = 1; }',
    'class S { @log(this) m() {} }',
    'class S extends this.Base {}',
    'class S { m = function () { return this; }; }',
    'class S { [function () { return this; }]() {} }',
  ].map((code) => ({ code, options: inClasses, errors: [{ messageId: 'noThis' }] })),
});

tester.run('no-this, with allowInClasses off', noThis, {
  valid: [],
  invalid: [
    {
      code: 'class S { m() { return this.x; } }',
      options: [{ allowInClasses: false }],
      errors: [{ messageId: 'noThis' }],
    },
  ],
});
