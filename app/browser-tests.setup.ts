// The browser project's setup: loads the app's stylesheet before every component and hook test, so
// visibility in a test reflects the app's real styles. vitest.config.ts runs it; tests don't import
// the stylesheet themselves.
import './index.css';
