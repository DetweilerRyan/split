// A local oxlint JS plugin that keeps the code functional: it bans classes, except Error
// subclasses, and `this`, which its allowInClasses option allows inside the classes that are
// kept. `.oxlintrc.json` loads it through "jsPlugins" and turns on its rules as
// `functional/no-classes` and `functional/no-this`. The rule is principle 2 of
// docs/engineering/code-design-principles.md; why it, and this plugin, are as they are is in that
// document's sidecar. Read the sidecar only when changing or questioning the plugin.
// Node, and so oxlint, runs this as TypeScript by stripping the types, so use only syntax that
// erases: no enums, namespaces or parameter properties.
import type { RuleTester } from 'oxlint/plugins-dev';

/** An oxlint rule. oxlint exports the type only as what its RuleTester runs. */
type Rule = Parameters<RuleTester['run']>[1];

/** A class node, as oxlint's visitors are given it. */
type ClassNode = Parameters<
  NonNullable<ReturnType<Extract<Rule, { readonly create: unknown }>['create']>['ClassDeclaration']>
>[0];

const WHY = 'functions over stateful classes, as the owner decided on DetweilerRyan/split#81';

/** The name a class `extends`: an identifier, or the last name of a `a.b.Name` path. */
function superName(superClass: ClassNode['superClass']): string | undefined {
  if (superClass?.type === 'Identifier') return superClass.name;
  if (superClass?.type === 'MemberExpression' && !superClass.computed) {
    return superClass.property.name;
  }
  return undefined;
}

/** A `this` node, as oxlint's visitors are given it. */
type ThisNode = Parameters<
  NonNullable<ReturnType<Extract<Rule, { readonly create: unknown }>['create']>['ThisExpression']>
>[0];

/**
 * Whether a `this` is in a type, as in `typeof this` or `typeof this.x`, which only names a type
 * and reads nothing at run time.
 */
function inTypeQuery(node: ThisNode): boolean {
  let parent = node.parent;
  while (parent.type === 'TSQualifiedName') parent = parent.parent;
  return parent.type === 'TSTypeQuery';
}

/** Whether a class extends `Error` or a class whose name ends in `Error`. */
function extendsError(superClass: ClassNode['superClass']): boolean {
  return superName(superClass)?.endsWith('Error') ?? false;
}

export const noClasses: Rule = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow classes, except Error subclasses' },
    messages: {
      noClasses: `Write functions over plain data, or a factory that closes over its state, not a class: ${WHY}. Only an Error subclass may be a class.`,
    },
    schema: [],
  },
  create(context) {
    return {
      ClassDeclaration(node) {
        if (!extendsError(node.superClass)) context.report({ node, messageId: 'noClasses' });
      },
      ClassExpression(node) {
        if (!extendsError(node.superClass)) context.report({ node, messageId: 'noClasses' });
      },
    };
  },
};

/** A node on the way up from a `this`, as far as `bindsToClass` needs to see it. */
type Ancestor = ThisNode['parent'];

/** Whether `fn`, a function, is the body of a class's method, constructor or accessor. */
function isClassMethod(fn: Ancestor): boolean {
  return fn.parent?.type === 'MethodDefinition' && fn.parent.value === fn;
}

/**
 * Whether a `this` reads the class it's written in: the scope it binds to is a class's method,
 * constructor, accessor, field value or static block. A `function` binds its own `this`, so one
 * inside a method doesn't read the class; an arrow function binds none, so one does. A `this` in a
 * computed key, a decorator or an `extends` clause reads the scope around the class.
 */
function bindsToClass(node: ThisNode): boolean {
  let child: Ancestor = node;
  let parent: Ancestor | null = node.parent;
  while (parent) {
    if (parent.type === 'FunctionExpression' || parent.type === 'FunctionDeclaration') {
      return isClassMethod(parent);
    }
    if (parent.type === 'StaticBlock') return true;
    if (parent.type === 'PropertyDefinition' || parent.type === 'AccessorProperty') {
      if (parent.value === child) return true;
    }
    child = parent;
    parent = parent.parent;
  }
  return false;
}

/** Whether `no-this`'s options, as `.oxlintrc.json` gives them, turn on `allowInClasses`. */
function allowsInClasses(options: readonly unknown[]): boolean {
  return Reflect.get(Object(options[0]), 'allowInClasses') === true;
}

export const noThis: Rule = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow `this`, or with allowInClasses, `this` outside a class' },
    messages: {
      noThis: `Take what a function needs as a parameter, or close over it, rather than reading \`this\`: ${WHY}.`,
    },
    schema: [
      {
        type: 'object',
        properties: { allowInClasses: { type: 'boolean' } },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const inClasses = allowsInClasses(context.options);
    return {
      ThisExpression(node) {
        if (inTypeQuery(node)) return;
        if (inClasses && bindsToClass(node)) return;
        context.report({ node, messageId: 'noThis' });
      },
    };
  },
};

export default {
  meta: { name: 'functional' },
  rules: { 'no-classes': noClasses, 'no-this': noThis },
} as const;
