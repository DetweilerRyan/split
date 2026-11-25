/**
 * `T` readonly at every level. A test uses it for the values fast-check generates, which its types
 * leave mutable, so they can be passed where a parameter is readonly all the way down, as
 * `typescript/prefer-readonly-parameter-types` asks.
 */
export type DeepReadonly<T> = { readonly [K in keyof T]: DeepReadonly<T[K]> };
