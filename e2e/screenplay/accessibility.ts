import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

/**
 * The WCAG 2.0, 2.1 and 2.2 rules at levels A and AA that axe checks automatically. axe's
 * `best-practice` rules aren't required by any WCAG criterion, so they're left out until the
 * WCAG set passes (#72).
 */
const wcagAA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] as const;

/**
 * One axe rule a page breaks, and where: enough to say what to fix, and to tell barriers apart
 * without the rendered HTML, which changes for unrelated reasons.
 */
export type Barrier = {
  readonly rule: string;
  readonly help: string;
  readonly helpUrl: string;
  /** Each element the rule flagged, as the selector axe gives for it. */
  readonly targets: readonly string[];
};

/** What a scan found: rules the page breaks, and rules axe couldn't decide either way. */
export type Scan = {
  readonly barriers: readonly Barrier[];
  /** Checks axe couldn't finish, such as contrast over a blurred backdrop: check these by eye. */
  readonly undecided: readonly Barrier[];
};

function barrier(result: {
  readonly id: string;
  readonly help: string;
  readonly helpUrl: string;
  readonly nodes: readonly { readonly target: readonly unknown[] }[];
}): Barrier {
  return {
    rule: result.id,
    help: result.help,
    helpUrl: result.helpUrl,
    targets: result.nodes.map((node) => node.target.map(String).join(' ')),
  };
}

/** Scans what `page` shows now for the WCAG A and AA barriers axe can find. */
export async function scanForBarriers(page: Page): Promise<Scan> {
  const results = await new AxeBuilder({ page }).withTags([...wcagAA]).analyze();
  return {
    barriers: results.violations.map(barrier),
    undecided: results.incomplete.map(barrier),
  };
}

function describeBarriers(barriers: readonly Barrier[]): string {
  return barriers
    .map(
      ({ rule, help, helpUrl, targets }) =>
        `${rule}: ${help} (${helpUrl})\n${targets.map((target) => `  - ${target}`).join('\n')}`,
    )
    .join('\n');
}

/** Fails, listing each barrier with what to fix and where to read how, if `scan` found any. */
export function assertNoBarriers(where: string, scan: Scan): void {
  if (scan.barriers.length === 0) return;
  throw new Error(
    `${where} has accessibility barriers. Fix each one; the link says how:\n` +
      describeBarriers(scan.barriers),
  );
}
