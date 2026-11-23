import { createBdd, test as base } from 'playwright-bdd';
import { Actor } from './actor.ts';

/**
 * The scenario's cast: the same name always gives the same actor within one scenario. It takes no
 * `browser` or `page`, so Playwright never starts one.
 */
export const test = base.extend<{ actorCalled: (name: string) => Actor }>({
  // oxlint-disable-next-line no-empty-pattern -- Playwright requires a destructured first argument.
  actorCalled: async ({}, use) => {
    const cast = new Map<string, Actor>();
    await use((name) => {
      let actor = cast.get(name);
      if (!actor) {
        actor = new Actor(name);
        cast.set(name, actor);
      }
      return actor;
    });
    for (const actor of cast.values()) actor.exit();
  },
});

export const { Given, When, Then } = createBdd(test);
