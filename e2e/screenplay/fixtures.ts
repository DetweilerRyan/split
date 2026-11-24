import { createBdd, test as base } from 'playwright-bdd';
import { type Actor, createActor } from './actor';

/** The scenario's cast: the same name always gives the same actor within one scenario. */
export const test = base.extend<{ actorCalled: (name: string) => Actor }>({
  actorCalled: async ({ browser, baseURL }, use) => {
    if (!baseURL) throw new Error('playwright.config.ts must set use.baseURL.');
    const cast = new Map<string, Actor>();
    await use((name) => {
      let actor = cast.get(name);
      if (!actor) {
        actor = createActor(name, browser, baseURL);
        cast.set(name, actor);
      }
      return actor;
    });
    await Promise.all([...cast.values()].map((actor) => actor.exit()));
  },
});

export const { Given, When, Then } = createBdd(test);
