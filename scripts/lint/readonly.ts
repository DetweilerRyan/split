// A local oxlint JS plugin that makes the types we declare readonly by default. `.oxlintrc.json`
// loads it through "jsPlugins" and turns on its rule as `readonly/types`. What the rule asks of
// code, and what it doesn't check, is in readonly.md beside this file; why it works as it does is
// in readonly.meta.md. Read the sidecar only when changing or questioning the rule.
// Node, and so oxlint, runs this as TypeScript by stripping the types, so use only syntax that
// erases: no enums, namespaces or parameter properties.
import type { RuleTester } from 'oxlint/plugins-dev';

/** An oxlint rule. oxlint exports the type only as what its RuleTester runs. */
type Rule = Parameters<RuleTester['run']>[1];

/** The visitors a rule's `create` returns, one per kind of node. */
type Visitors = NonNullable<ReturnType<Extract<Rule, { readonly create: unknown }>['create']>>;

/** A node of kind `K`, as oxlint's visitor for it is given it. */
type NodeOf<K extends keyof Visitors> = Parameters<NonNullable<Visitors[K]>>[0];

/** Any node, as oxlint gives a node's parent. */
type AnyNode = NodeOf<'TSArrayType'>['parent'];

const WHY = 'types are readonly by default, as the owner decided on DetweilerRyan/split#69';

/** Whether `node` is a function, so a variable declared under it is local. */
function isFunction(node: AnyNode): boolean {
  return (
    node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression' ||
    node.type === 'ArrowFunctionExpression'
  );
}

/**
 * Whether the walk up from a type may go on through `node` and still be in the same type. Types
 * nest TS nodes, and a function type's parameters are identifiers and patterns.
 */
function inType(node: AnyNode): boolean {
  return (
    node.type.startsWith('TS') ||
    node.type === 'Identifier' ||
    node.type === 'RestElement' ||
    node.type === 'ObjectPattern' ||
    node.type === 'ArrayPattern'
  );
}

/** Whether `annotation` is the type of a variable that a `const`, `let` or `var` declares. */
function annotatesVariable(annotation: AnyNode): boolean {
  const binding = annotation.parent;
  const declarator = binding?.parent;
  return (
    annotation.type === 'TSTypeAnnotation' &&
    declarator?.type === 'VariableDeclarator' &&
    declarator.id === binding
  );
}

/** Whether `node` is under a function, before the module's top level. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- oxlint's AST nodes are mutable, and `allow` can't name them once `| null` joins their union.
function underFunction(node: AnyNode | null): boolean {
  for (let at = node; at !== null; at = at.parent) {
    if (isFunction(at)) return true;
  }
  return false;
}

/**
 * Whether `node` is in the type annotation of a variable declared inside a function, such as
 * `const out: string[] = []`, which may be a mutable working value.
 */
function inLocalAnnotation(node: AnyNode): boolean {
  for (let at: AnyNode | null = node; at !== null && inType(at); at = at.parent) {
    if (annotatesVariable(at)) return underFunction(at.parent);
  }
  return false;
}

/**
 * Whether `Readonly<…>` reaches through `node` to the types in it: a union or an intersection.
 * oxlint's tree has no node for parentheses around a type, so they need none here.
 */
function passesReadonly(node: AnyNode): boolean {
  return node.type === 'TSUnionType' || node.type === 'TSIntersectionType';
}

/**
 * Whether `node` is the type argument of `Readonly<…>`, directly or as a member of a union or an
 * intersection in it.
 */
function inReadonlyWrapper(node: AnyNode): boolean {
  let parent = node.parent;
  while (parent !== null && passesReadonly(parent)) parent = parent.parent;
  const reference = parent?.parent;
  return (
    parent?.type === 'TSTypeParameterInstantiation' &&
    reference?.type === 'TSTypeReference' &&
    reference.typeName.type === 'Identifier' &&
    reference.typeName.name === 'Readonly'
  );
}

/** Whether an array or tuple type is readonly: `readonly T[]`, or inside `Readonly<…>`. */
function readonlyList(node: AnyNode): boolean {
  const parent = node.parent;
  return (
    (parent?.type === 'TSTypeOperator' && parent.operator === 'readonly') || inReadonlyWrapper(node)
  );
}

/** Whether the members of an object type or interface are readonly through `Readonly<…>`. */
function readonlyMembers(holder: AnyNode): boolean {
  return holder.type === 'TSTypeLiteral' && inReadonlyWrapper(holder);
}

/** The message for a mutable `Array`, `Map`, `Set` or `Record` reference, or none. */
function referenceProblem(node: NodeOf<'TSTypeReference'>): string | undefined {
  if (node.typeName.type !== 'Identifier') return undefined;
  switch (node.typeName.name) {
    case 'Array':
      return inReadonlyWrapper(node) ? undefined : 'array';
    case 'Record':
      return inReadonlyWrapper(node) ? undefined : 'record';
    case 'Map':
      return 'map';
    case 'Set':
      return 'set';
    default:
      return undefined;
  }
}

export const types: Rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require readonly arrays, tuples, maps, sets, records, properties and index signatures',
    },
    messages: {
      list: `Write \`readonly T[]\` or \`readonly [A, B]\`: ${WHY}.`,
      array: `Write \`ReadonlyArray<T>\` or \`readonly T[]\`, not \`Array<T>\`: ${WHY}.`,
      map: `Write \`ReadonlyMap<K, V>\`, not \`Map<K, V>\`: ${WHY}.`,
      set: `Write \`ReadonlySet<T>\`, not \`Set<T>\`: ${WHY}.`,
      record: `Write \`Readonly<Record<K, V>>\`, not \`Record<K, V>\`: ${WHY}.`,
      property: `Mark the property \`readonly\`, or wrap its object type in \`Readonly<…>\`: ${WHY}.`,
      index: `Mark the index signature \`readonly\`, or wrap its object type in \`Readonly<…>\`: ${WHY}.`,
      mapped: `Write \`readonly [K in …]\`, or wrap the mapped type in \`Readonly<…>\`: ${WHY}.`,
    },
    schema: [],
  },
  create(context) {
    /** Reports `node` with `messageId`, unless it's in a local variable's annotation. */
    function report(node: AnyNode, messageId: string) {
      if (!inLocalAnnotation(node)) context.report({ node, messageId });
    }
    return {
      TSArrayType(node) {
        if (!readonlyList(node)) report(node, 'list');
      },
      TSTupleType(node) {
        if (!readonlyList(node)) report(node, 'list');
      },
      TSTypeReference(node) {
        const problem = referenceProblem(node);
        if (problem !== undefined) report(node, problem);
      },
      TSPropertySignature(node) {
        if (!node.readonly && !readonlyMembers(node.parent)) report(node, 'property');
      },
      TSIndexSignature(node) {
        if (!node.readonly && !readonlyMembers(node.parent)) report(node, 'index');
      },
      TSMappedType(node) {
        const readonly = node.readonly === true || node.readonly === '+';
        if (!readonly && !inReadonlyWrapper(node)) report(node, 'mapped');
      },
    };
  },
};

export default {
  meta: { name: 'readonly' },
  rules: { types },
} as const;
