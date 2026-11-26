# Clarity and brevity

Agents follow this repository's documents, so each instruction must be short and read one way only. This document says how to write one, and how to review a document for clarity and brevity.

## Rules

- **Keep every sentence to 25 words or fewer.** Count a list's lead-in and each item as separate sentences. Leave code spans, tables and link targets out of the count.
- **Use the active voice.** Name who acts: "setup installs the browser", not "the browser is installed".
- **Write a rule as an imperative,** such as "Name each test after the behaviour it pins down". A bold name that defines a term may stay a statement, such as "A collaborator's own tests are its contract tests".
- **Give each bullet one instruction.** Split a bullet that asks for two things into two bullets.
- **Put a list in bullets when it sets a rule's scope,** or when it has more than three items. A short list of examples may stay inline.
- **Phrase a rule positively:** say what to do. Keep a negative for an absolute ban, such as "Never mock React or its hooks".
- **State the rule, then show one example.** More examples teach the pattern of the examples rather than the rule.
- **Make every link say what it's for,** or when to read it. A bare path leaves the reader guessing.
- **Keep every heading when you rewrite a document.** Other documents link to its headings' anchors.

## Keep the meaning

A rewrite for brevity changes words, never rules. Check each rule against its old text for these changes:

- **A permission that became an instruction,** such as "`vi.fn()` is fine" becoming "Use `vi.fn()`".
- **A description that became an instruction,** such as "setup installs the browser" becoming "Install the browser".
- **A ban that grew or shrank,** such as "don't add a parameter just for a fake" becoming "add one only for this test".
- **A condition that fell off its rule,** such as "once the section says it's worth it" disappearing when a sentence is split.
- **A qualifier that moved to another subject,** such as "whether the code uses it" moving from one item to the whole list.
- **An instruction that now contradicts its neighbour,** often because a description was made an imperative.

Restore each one. When a change is meant, record it in the document's sidecar, as [Single source of truth](single-source-of-truth.md#reasons-live-in-a-metamd-sidecar) says.

## Reviewing a document

1. **Measure it.** List every sentence over 25 words, using the counting rule above.
2. **Rewrite it,** following [the rules](#rules), one section at a time.
3. **Compare old and new rule by rule,** for the changes [Keep the meaning](#keep-the-meaning) lists. Have someone who didn't write the rewrite do it, such as a subagent given both texts.
4. **Check the links.** Run `npm run lint`, which checks links and anchors. Search the repository for each bold rule name you changed, with `git grep -n "<name>"`, and update any document that quotes it.
5. **Record the pass** in the document's sidecar: who asked, what changed, and what the comparison found.

## Changing this document

The reasons for these rules and their sources are in [clarity-and-brevity.meta.md](clarity-and-brevity.meta.md). Read it only when changing or questioning a rule here.
