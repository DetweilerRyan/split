import { createBdd, test as base } from 'playwright-bdd';
import { assertNoBarriers, scanForBarriers } from './accessibility';
import { type Actor, createActor } from './actor';

/** Attaches a JSON document to the scenario's report. */
type AttachJson = (name: string, json: string) => Promise<void>;

/**
 * Scans the page each actor ends a passing scenario on, so every screen a scenario reaches is
 * checked for accessibility barriers. Checks axe couldn't decide are attached to the report.
 */
async function scanWhereActorsEnded(cast: readonly Actor[], attach: AttachJson): Promise<void> {
  for (const actor of cast.filter((member) => member.hasBrowsed())) {
    const scan = await scanForBarriers(actor.page);
    if (scan.undecided.length > 0) {
      await attach(
        `accessibility checks to do by eye, for ${actor.name}`,
        JSON.stringify(scan.undecided, null, 2),
      );
    }
    assertNoBarriers(`The page ${actor.name} ended the scenario on`, scan);
  }
}

/** The scenario's cast: the same name always gives the same actor within one scenario. */
export const test = base.extend<{ readonly actorCalled: (name: string) => Actor }>({
  actorCalled: async ({ browser, baseURL }, use, testInfo) => {
    if (baseURL === undefined || baseURL === '')
      throw new Error('playwright.config.ts must set use.baseURL.');
    const cast = new Map<string, Actor>();
    await use((name) => {
      let actor = cast.get(name);
      if (actor === undefined) {
        actor = createActor(name, browser, baseURL);
        cast.set(name, actor);
      }
      return actor;
    });
    try {
      // A scenario that already failed is reported for that; a scan would only add noise.
      if (testInfo.status === testInfo.expectedStatus) {
        await scanWhereActorsEnded([...cast.values()], (name, json) =>
          testInfo.attach(name, { body: json, contentType: 'application/json' }),
        );
      }
    } finally {
      await Promise.all([...cast.values()].map((actor) => actor.exit()));
    }
  },
});

export const { Given, When, Then } = createBdd(test);
