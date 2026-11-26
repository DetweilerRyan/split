# Clarity and brevity: reasons

The reasons for [Clarity and brevity](clarity-and-brevity.md)'s rules.

## Where it came from

- **The owner asked for the review first,** on [#159](https://github.com/DetweilerRyan/split/pull/159#issuecomment-7200675081), on 2026-11-26: "can you do a clarity and brevity review of the testing-conventions.md doc. things like use the active voice, prefer bulleted lists over comma seperated ones, no sentences over 25 words and unambigious instructions. feel free to also take a look at what agentpatterns.ai has to say on this sort of thing".
- **Then for this document,** in the same session: "i'd like you to write a new document under docs/prose/ that outlines the review you just ran" ([recorded](#)).
- **The active voice, bulleted lists, the 25-word limit and unambiguous instructions** are the owner's four criteria. agentpatterns.ai has no page on sentence length or the active voice.

## The rules

- **Counting a list's lead-in and items apart:** the review of `testing-conventions.md` counted that way, so a bulleted list isn't one long sentence. Without it, a lead-in and its list read as about 33 words in two places, which the comparison noted.
- **Bold definitions may stay statements:** a term such as "contract tests" is defined, not commanded. The review's comparison flagged forcing those into imperatives as overclaiming.
- **Bullets for a list that sets a rule's scope:** the comparison found that the lists which mattered most were those deciding what a rule covers, such as what to fake at the edge. Short lists of examples read fine inline.
- **Positive phrasing, with negatives for absolute bans:** agentpatterns.ai quotes Anthropic's guidance, "Tell Claude what to do instead of what not to do", and keeps negatives where the prohibition is absolute ([Instruction Polarity](https://agentpatterns.ai/instructions/instruction-polarity/), checked 2026-11-26).
- **One rule, then one example:** "state the rule, then show one example", since more examples "can shift agent focus from the rule to the pattern of the examples" ([Example-Driven vs Rule-Driven Instructions](https://agentpatterns.ai/instructions/example-driven-vs-rule-driven-instructions/), checked 2026-11-26).
- **Links say what they're for:** agentpatterns.ai's catalogue of configuration smells names "Blind References", a path with no note on when or why to read it ([Configuration Smells in AGENTS.md Files](https://agentpatterns.ai/patterns/anti-patterns/configuration-smells-agents-md/), checked 2026-11-26).
- **Keeping headings:** other documents link to anchors made from headings, and `npm run lint` fails when one breaks.

## Keep the meaning

- **Every case in the list happened.** In the first rewrite of `testing-conventions.md`, a comparison of old and new text found each of these changes ([#159](https://github.com/DetweilerRyan/split/pull/159)):
  - a ban on parameters widened;
  - the condition on when to write a collaboration test dropped;
  - "`vi.fn()` is fine" and "the browser is installed by setup" turned into orders;
  - a qualifier moved onto the whole list;
  - "fake the collaborators" contradicted the rule to pass untested ones in real.
- **Why someone else compares:** the writer of the rewrite had just claimed no meaning changed. An independent comparison, given both texts, found four rules changed.

## Options not taken

- **A lint check for sentence length,** such as Vale's. It would need a new dependency, which [Choosing and adding dependencies](../engineering/dependencies.md) asks the owner to approve. The review used a throwaway script instead.

## What would reopen this

- **A rule here that a review keeps breaking,** or one that makes a document harder to follow. Change the rule, and record why here.
