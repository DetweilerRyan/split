// A local oxlint JS plugin that keeps the code functional: it bans classes, except Error
// subclasses, and `this`. `.oxlintrc.json` loads it through "jsPlugins" and turns on its rules as
// `functional/no-classes` and `functional/no-this`. The rule is in docs/engineering/README.md's
// "Code style"; why it, and this plugin, are as they are is in docs/engineering/README.meta.md.
// Read that only when changing or questioning the plugin.
// Node, and so oxlint, runs this as TypeScript by stripping the types, so use only syntax that
// erases: no enums, namespaces or parameter properties.
import type { RuleTester } from 'oxlint/plugins-dev';

/** An oxlint rule. oxlint exports the type only as what its RuleTester runs. */
type Rule = Parameters<RuleTester['run']>[1];

/** A class node, as oxlint's visitors are given it. */
type ClassNode = Parameters<
  NonNullable<ReturnType<Extract<Rule, { create: unknown }>['create']>['ClassDeclaration']>
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
  NonNullable<ReturnType<Extract<Rule, { create: unknown }>['create']>['ThisExpression']>
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

export const noThis: Rule = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow `this`' },
    messages: {
      noThis: `Take what a function needs as a parameter, or close over it, rather than reading \`this\`: ${WHY}.`,
    },
    schema: [],
  },
  create(context) {
    return {
      ThisExpression(node) {
        if (!inTypeQuery(node)) context.report({ node, messageId: 'noThis' });
      },
    };
  },
};

export default {
  meta: { name: 'functional' },
  rules: { 'no-classes': noClasses, 'no-this': noThis },
} as const;
