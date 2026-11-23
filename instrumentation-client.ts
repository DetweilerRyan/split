// Next.js runs this in the browser before the app's own code. See
// node_modules/next/dist/docs/01-app/02-guides/analytics.md.
import { loadDialogClosedByPolyfill } from './src/polyfills/dialogClosedBy';

void loadDialogClosedByPolyfill();
