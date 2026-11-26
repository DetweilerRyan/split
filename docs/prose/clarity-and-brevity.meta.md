# Clarity and brevity: reasons

The reasons for [Clarity and brevity](clarity-and-brevity.md)'s rules.

## Where it came from

- **The owner asked for the review first,** on 2026-11-26 ([recorded on #159](https://github.com/DetweilerRyan/split/pull/159#issuecomment-7200675081)): "can you do a clarity and brevity review of the testing-conventions.md doc. things like use the active voice, prefer bulleted lists over comma seperated ones, no sentences over 25 words and unambigious instructions. feel free to also take a look at what agentpatterns.ai has to say on this sort of thing".
- **Then for this document,** in the same session ([recorded on #167](https://github.com/DetweilerRyan/split/pull/167#issuecomment-7200912697)): "i'd like you to write a new document under docs/prose/ that outlines the review you just ran".
- **The owner's four criteria** are the active voice, bulleted lists, the 25-word limit, and unambiguous instructions. Each has a rule.
- **agentpatterns.ai has no page on sentence length or the active voice.** Its writing page sets a 40–60-word limit only for an answer that opens a section.

## What it covers

- **Documents and skill files follow every rule,** since agents follow them as instructions.
- **Sidecars follow the rules where they can.** They hold reasons, sources and quotations, which run longer than instructions.
- **Quotations are exempt,** since a quotation that's shortened or reworded no longer records what was said.
- **This scope was the session's call,** after a review found the document didn't say. Reopen it if the owner wants sidecars, or pull request and issue text, held to every rule.

## The rules

- **Counting a list's lead-in and items apart:** the review's script counted that way, so a bulleted list doesn't count as one long sentence.
- **Keeping each rule's kind:** the first rewrite on #159 turned a permission and a description into orders ([the review's findings](https://github.com/DetweilerRyan/split/pull/159#issuecomment-7200813007)). The forms the fix used, "You may use" and "Let setup install", are the examples. Bold names that define a term stayed statements in that review.
- **Bullets for a list that sets a rule's scope:** the review bulleted lists that decide what a rule covers, such as what to fake at the edge, and left short noun lists inline.
- **Reading one way:** the owner's fourth criterion. The review found a condition that fell off its rule, and an instruction that contradicted its neighbour.
- **Positive phrasing:** agentpatterns.ai quotes Anthropic's guidance, "Tell Claude what to do instead of what not to do" ([Instruction Polarity](https://agentpatterns.ai/instructions/instruction-polarity/), checked 2026-11-26). It keeps a negative in three cases:
  - "The prohibition is absolute and the positive form would be ambiguous";
  - when "naming a specific banned item";
  - when "The space of acceptable alternatives is too large to list".
- **One example:** "state the rule, then show one example", since more examples "can shift agent focus from the rule to the pattern of the examples" ([Example-Driven vs Rule-Driven Instructions](https://agentpatterns.ai/instructions/example-driven-vs-rule-driven-instructions/), checked 2026-11-26).
- **Links say what they're for:** agentpatterns.ai's catalogue names "Blind References", "Bare path references with no pitch on when or why to read them" ([Configuration Smells in AGENTS.md Files](https://agentpatterns.ai/patterns/anti-patterns/configuration-smells-agents-md/), checked 2026-11-26).
- **Keeping headings:** other documents link to anchors made from headings, and `npm run lint` fails when one breaks.

## Keep the meaning

- **Each case in the list happened** in the first rewrite of `testing-conventions.md` on #159. The comparison found six changes to four rules ([the review's findings](https://github.com/DetweilerRyan/split/pull/159#issuecomment-7200813007)):
  - a ban on parameters widened;
  - the condition on when to write a collaboration test dropped;
  - "`vi.fn()` is fine" became an order;
  - "the browser is installed by setup" became an order;
  - a qualifier moved onto the whole list;
  - "fake the collaborators" contradicted the rule to pass untested ones in real.
- **Why someone else compares:** the session that wrote the rewrite had just recorded that no rule's meaning changed. A subagent given both texts then found the six changes.

## The procedure

- **Steps 1 to 5 and 7 are the review as it ran** on #159: measure with a script, rewrite, compare, fix and measure again, lint, and record.
- **Step 6, updating documents that quote a changed bold name,** is new. The review checked that no other document quoted one, and this step makes that check part of the procedure.

## Options not taken

- **A lint check for sentence length,** such as Vale's. It would need a new dependency, which [Choosing and adding dependencies](../engineering/dependencies.md) asks the owner to approve. The review used a throwaway script instead.
- **A fixed item count for bulleting a list,** such as "more than three". The review bulleted by what a list does, not its length, and kept some four-item lists of examples inline.

## Reopen when

- **A review keeps breaking a rule here,** or a rule makes a document harder to follow.
