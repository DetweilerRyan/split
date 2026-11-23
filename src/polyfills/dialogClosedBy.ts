/**
 * Loads `dialog-closedby-polyfill` where the browser doesn't support `<dialog closedby>`, which
 * Safari doesn't yet, so `ModalDialog` closes on a tap outside everywhere. Browsers that support it
 * never download the polyfill. Returns the pending import, or `undefined` when none is needed.
 *
 * Once every browser the app supports has `closedby`, delete this module, its call in
 * `instrumentation-client.ts`, and the package.
 */
export function loadDialogClosedByPolyfill(
  dialogPrototype: object = HTMLDialogElement.prototype,
  load: () => Promise<unknown> = () => import('dialog-closedby-polyfill'),
): Promise<unknown> | undefined {
  if ('closedBy' in dialogPrototype) return undefined;
  return load();
}
