// A local oxlint JS plugin that checks fast-check property tests for the mistakes that make one pass
// without testing anything, or fail where it can't be replayed. `.oxlintrc.json` loads it through
// "jsPlugins" and turns on its rules, as `property/<rule>`, for `*.property.test.ts` files. What
// each rule asks of a test is in property.md beside this file; why they work as they do is in
// property.meta.md. Read the sidecar only when changing or questioning a rule.
// Node, and so oxlint, runs this as TypeScript by stripping the types, so use only syntax that
// erases: no enums, namespaces or parameter properties.
import type { RuleTester } from 'oxlint/plugins-dev';

/** An oxlint rule. oxlint exports the type only as what its RuleTester runs. */
type Rule = Parameters<RuleTester['run']>[1];

/** What a rule's `create` is given. */
type Context = Parameters<Extract<Rule, { readonly create: unknown }>['create']>[0];

/** The visitors a rule's `create` returns, one per kind of node. */
type Visitors = NonNullable<ReturnType<Extract<Rule, { readonly create: unknown }>['create']>>;

/** A node of kind `K`, as oxlint's visitor for it is given it. */
type NodeOf<K extends keyof Visitors> = Parameters<NonNullable<Visitors[K]>>[0];

/** Any node, as oxlint gives a node's parent. */
type AnyNode = NodeOf<'CallExpression'>['parent'];

/** A call, as oxlint gives it. */
type Call = NodeOf<'CallExpression'>;

const WHY = 'docs/engineering/testing/property-testing.md says how to write a property test';

/** The names a file binds fast-check to: its default import and its namespace import. */
function fastCheckNames(context: Context): ReadonlySet<string> {
  const names = new Set<string>();
  for (const statement of context.sourceCode.ast.body) {
    if (statement.type !== 'ImportDeclaration' || statement.source.value !== 'fast-check') {
      continue;
    }
    for (const specifier of statement.specifiers) {
      if (
        specifier.type === 'ImportDefaultSpecifier' ||
        specifier.type === 'ImportNamespaceSpecifier'
      ) {
        names.add(specifier.local.name);
      }
    }
  }
  return names;
}

/** The method a call names on fast-check, as `assert` in `fc.assert(…)`, or none. */
function fastCheckMethod(node: AnyNode, names: ReadonlySet<string>): string | undefined {
  if (node.type !== 'CallExpression') return undefined;
  const callee = node.callee;
  if (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.object.type === 'Identifier' &&
    names.has(callee.object.name) &&
    callee.property.type === 'Identifier'
  ) {
    return callee.property.name;
  }
  return undefined;
}

/** Whether a call builds a property: `fc.property(…)` or `fc.asyncProperty(…)`. */
function buildsProperty(node: AnyNode, names: ReadonlySet<string>): boolean {
  const method = fastCheckMethod(node, names);
  return method === 'property' || method === 'asyncProperty';
}

/** Whether a call runs a property: `fc.assert(…)` or `fc.check(…)`. */
function runsProperty(node: AnyNode, names: ReadonlySet<string>): boolean {
  const method = fastCheckMethod(node, names);
  return method === 'assert' || method === 'check';
}

/** Whether `node` is what a call to `fc.assert` or `fc.check` runs: its first argument. */
function isRun(node: AnyNode, names: ReadonlySet<string>): boolean {
  const parent = node.parent;
  return (
    parent !== null &&
    runsProperty(parent, names) &&
    parent.type === 'CallExpression' &&
    parent.arguments[0] === node
  );
}

/** Whether a function node is one: a declaration, an expression or an arrow. */
function isFunction(node: AnyNode): boolean {
  return (
    node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression' ||
    node.type === 'ArrowFunctionExpression'
  );
}

/** Whether a function is the predicate of a property: the last argument of `fc.property(…)`. */
function isPredicate(node: AnyNode, names: ReadonlySet<string>): boolean {
  const parent = node.parent;
  return (
    isFunction(node) &&
    parent?.type === 'CallExpression' &&
    buildsProperty(parent, names) &&
    parent.arguments.at(-1) === node
  );
}

/** Whether `node` is inside a property's predicate, at any depth. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- oxlint's AST nodes are mutable, and `allow` can't name them once `| null` joins their union.
function inPredicate(node: AnyNode | null, names: ReadonlySet<string>): boolean {
  for (let at = node; at !== null; at = at.parent) {
    if (isPredicate(at, names)) return true;
  }
  return false;
}

/** The name at the root of a chain of calls and member reads, as `expect` in `expect(a).toBe(b)`. */
function rootName(node: AnyNode): string | undefined {
  let at = node;
  for (;;) {
    if (at.type === 'Identifier') return at.name;
    if (at.type === 'CallExpression') at = at.callee;
    else if (at.type === 'MemberExpression') at = at.object;
    else return undefined;
  }
}

/** The name of a property in an object literal, when it's written as a name or a string. */
function keyName(property: AnyNode): string | undefined {
  if (property.type !== 'Property' || property.computed) return undefined;
  if (property.key.type === 'Identifier') return property.key.name;
  if (property.key.type === 'Literal' && typeof property.key.value === 'string') {
    return property.key.value;
  }
  return undefined;
}

/** Whether `node` is `Infinity` or `Number.POSITIVE_INFINITY`. */
function isInfinity(node: AnyNode): boolean {
  if (node.type === 'Identifier') return node.name === 'Infinity';
  return (
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.object.type === 'Identifier' &&
    node.object.name === 'Number' &&
    node.property.type === 'Identifier' &&
    node.property.name === 'POSITIVE_INFINITY'
  );
}

/** The leftover a parameter of `fc.assert` or `fc.check` is, if it is one. */
function leftover(property: AnyNode, names: ReadonlySet<string>): string | undefined {
  if (property.type !== 'Property') return undefined;
  switch (keyName(property)) {
    case 'seed':
    case 'path':
      return 'replay';
    case 'interruptAfterTimeLimit':
    case 'markInterruptAsFailure':
      return 'soak';
    case 'numRuns':
      return isInfinity(property.value) ? 'soak' : undefined;
    case 'plugins':
      return property.value.type === 'ArrayExpression' &&
        property.value.elements.some(
          (element) =>
            element !== null && fastCheckMethod(element, names) === 'interruptAfterTimeLimit',
        )
        ? 'soak'
        : undefined;
    case undefined:
    default:
      return undefined;
  }
}

/** The object literal of parameters a run of a property is given, if it's written in place. */
function parametersOf(call: Call): NodeOf<'ObjectExpression'> | undefined {
  const parameters = call.arguments[1];
  return parameters?.type === 'ObjectExpression' ? parameters : undefined;
}

/** Whether a variable holding a property is run: passed to `fc.assert` or `fc.check` somewhere. */
function variableIsRun(context: Context, declarator: AnyNode, names: ReadonlySet<string>): boolean {
  return context.sourceCode
    .getDeclaredVariables(declarator)
    .some((variable) =>
      variable.references.some((reference) => isRun(reference.identifier, names)),
    );
}

/** Whether a property built by `call` is run: passed in place, or through a variable. */
function propertyIsRun(context: Context, call: Call, names: ReadonlySet<string>): boolean {
  if (isRun(call, names)) return true;
  const parent = call.parent;
  return (
    parent.type === 'VariableDeclarator' &&
    parent.init === call &&
    variableIsRun(context, parent, names)
  );
}

export const asserted: Rule = {
  meta: {
    type: 'problem',
    docs: { description: 'Require each property to be run by fc.assert or fc.check' },
    messages: {
      unrun: `Pass this property to \`fc.assert\`, or \`fc.check\`: a property that's built but never run always passes. ${WHY}.`,
    },
    schema: [],
  },
  create(context) {
    const names = fastCheckNames(context);
    return {
      CallExpression(node) {
        if (buildsProperty(node, names) && !propertyIsRun(context, node, names)) {
          context.report({ node, messageId: 'unrun' });
        }
      },
    };
  },
};

export const noLeftovers: Rule = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow soak and replay settings in a property run' },
    messages: {
      soak: `Soak a property with PROPERTY_SOAK_SECONDS, not with settings in the test: they run CI for the soak's length. ${WHY}.`,
      replay: `Replay a failure with PROPERTY_SEED and PROPERTY_RUNS, not with a seed or path in the test: they make every run the same, and a soak can't reach it. ${WHY}.`,
    },
    schema: [],
  },
  create(context) {
    const names = fastCheckNames(context);
    return {
      CallExpression(node) {
        if (!runsProperty(node, names)) return;
        for (const property of parametersOf(node)?.properties ?? []) {
          const messageId = leftover(property, names);
          if (messageId !== undefined) context.report({ node: property, messageId });
        }
      },
    };
  },
};

export const noFilter: Rule = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow fc.pre and filtering an arbitrary' },
    messages: {
      pre: `Build the constraint into the arbitrary, such as \`fc.integer({ min: 1 })\`, instead of skipping inputs with \`fc.pre\`: skipped runs test nothing. ${WHY}.`,
      filter: `Build the constraint into the arbitrary, such as \`fc.integer({ min: 1 })\` or \`fc.uniqueArray\`, instead of filtering it: filtered inputs waste runs. ${WHY}.`,
    },
    schema: [],
  },
  create(context) {
    const names = fastCheckNames(context);
    return {
      CallExpression(node) {
        if (fastCheckMethod(node, names) === 'pre') {
          context.report({ node, messageId: 'pre' });
          return;
        }
        const callee = node.callee;
        if (
          callee.type === 'MemberExpression' &&
          !callee.computed &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'filter' &&
          names.has(rootName(callee.object) ?? '')
        ) {
          context.report({ node: callee.property, messageId: 'filter' });
        }
      },
    };
  },
};

export const predicate: Rule = {
  meta: {
    type: 'problem',
    docs: { description: "Require a property's predicate to check something and return nothing" },
    messages: {
      returns: `Assert with \`expect\` and return nothing from the predicate: a returned value is easy to get wrong, and \`expect\` says what failed. ${WHY}.`,
      empty: `Assert with \`expect\` inside the predicate: one that calls nothing and throws nothing passes whatever the code does. ${WHY}.`,
    },
    schema: [],
  },
  create(context) {
    const names = fastCheckNames(context);
    /** The predicates that call or throw something, found as the walk reaches each call or throw. */
    const checking = new Set<AnyNode>();
    /** The predicates reported for returning a value, which fast-check checks, so aren't empty. */
    const returning = new Set<AnyNode>();
    /** Marks each predicate `node` is inside as checking something. */
    function markChecking(node: AnyNode) {
      for (let at = node.parent; at !== null; at = at.parent) {
        if (isPredicate(at, names)) checking.add(at);
      }
    }
    return {
      CallExpression(node) {
        markChecking(node);
      },
      ThrowStatement(node) {
        markChecking(node);
      },
      ReturnStatement(node) {
        if (node.argument === null) return;
        for (let at: AnyNode | null = node.parent; at !== null; at = at.parent) {
          if (isFunction(at)) {
            if (isPredicate(at, names)) {
              returning.add(at);
              context.report({ node, messageId: 'returns' });
            }
            return;
          }
        }
      },
      ArrowFunctionExpression(node) {
        if (isPredicate(node, names) && node.expression && rootName(node.body) !== 'expect') {
          returning.add(node);
          context.report({ node: node.body, messageId: 'returns' });
        }
      },
      'CallExpression:exit'(node: Call) {
        if (!buildsProperty(node, names)) return;
        const fn = node.arguments.at(-1);
        if (fn !== undefined && isPredicate(fn, names) && !checking.has(fn) && !returning.has(fn)) {
          context.report({ node: fn, messageId: 'empty' });
        }
      },
    };
  },
};

export const noTry: Rule = {
  meta: {
    type: 'problem',
    docs: { description: "Disallow catching errors inside a property's predicate" },
    messages: {
      try: `Don't catch errors inside the predicate: a caught failure makes the property pass. Assert a thrown error with \`expect(() => …).toThrow()\`. ${WHY}.`,
    },
    schema: [],
  },
  create(context) {
    const names = fastCheckNames(context);
    return {
      TryStatement(node) {
        if (node.handler !== null && inPredicate(node, names)) {
          context.report({ node, messageId: 'try' });
        }
      },
    };
  },
};

export const noRandom: Rule = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow randomness fast-check does not control in a property test' },
    messages: {
      random: `Generate the value with an arbitrary instead of \`Math.random()\`: fast-check can't replay or shrink a value it didn't make. ${WHY}.`,
      sample: `Generate the value with an arbitrary passed to the property instead of \`fc.sample\`: fast-check can't replay or shrink a sampled value. ${WHY}.`,
    },
    schema: [],
  },
  create(context) {
    const names = fastCheckNames(context);
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (
          callee.type === 'MemberExpression' &&
          !callee.computed &&
          callee.object.type === 'Identifier' &&
          callee.object.name === 'Math' &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'random'
        ) {
          context.report({ node, messageId: 'random' });
        } else if (fastCheckMethod(node, names) === 'sample') {
          context.report({ node, messageId: 'sample' });
        }
      },
    };
  },
};

/** The start of the comment that says where a kept input was found. */
const ORIGIN = /^\s*Found by /;

export const exampleOrigin: Rule = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Require a comment saying where each kept example was found' },
    messages: {
      origin: `Say where this input was found, in a comment before it: \`// Found by a soak run on #<pull request>.\`, or by CI or a local run. ${WHY}.`,
    },
    schema: [],
  },
  create(context) {
    const names = fastCheckNames(context);
    return {
      CallExpression(node) {
        if (!runsProperty(node, names)) return;
        for (const property of parametersOf(node)?.properties ?? []) {
          if (
            property.type !== 'Property' ||
            keyName(property) !== 'examples' ||
            property.value.type !== 'ArrayExpression'
          ) {
            continue;
          }
          for (const example of property.value.elements) {
            if (
              example !== null &&
              !context.sourceCode
                .getCommentsBefore(example)
                .some((comment) => ORIGIN.test(comment.value))
            ) {
              context.report({ node: example, messageId: 'origin' });
            }
          }
        }
      },
    };
  },
};

export default {
  meta: { name: 'property' },
  rules: {
    asserted,
    'no-leftovers': noLeftovers,
    'no-filter': noFilter,
    predicate,
    'no-try': noTry,
    'no-random': noRandom,
    'example-origin': exampleOrigin,
  },
} as const;
