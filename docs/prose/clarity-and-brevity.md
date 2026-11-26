# Clarity and brevity

Agents follow this repository's documents, so each instruction must be short and read one way only. This document says how to write instructions, and how to review a document for clarity and brevity.

## What it covers

- **Documents and skill files** follow every rule here.
- **Sidecars** follow them where they can. A sidecar's quotations keep their original words.
- **Quotations anywhere** keep their original words and length.

## Rules

- **Keep every sentence to 25 words or fewer.** Count a list's lead-in and each item as separate sentences. Leave these out of the count:
  - code spans;
  - tables;
  - link targets.
- **Use the active voice.** Name who acts: "setup installs the browser", not "the browser is installed".
- **Write a rule as an imperative,** such as "Name each test after the one behaviour it pins down". Keep each rule's kind:
  - **A permission stays a permission,** such as "You may use `vi.fn()` when the test checks how something was called".
  - **A description stays a description,** or becomes an imperative that keeps who acts, such as "Let setup install the browser".
  - **A bold name that defines a term may stay a statement,** such as "A collaborator's own tests are its contract tests".
- **Give each bullet one instruction.** Split a bullet that asks for two things into two bullets.
- **Make each instruction read one way.** Keep its condition and its scope attached to it. Check that it doesn't contradict the instructions beside it.
- **Put a list in bullets when it sets a rule's scope.** A short list of examples may stay inline.
- **Phrase a rule positively:** say what to do. Keep a negative for an absolute ban, or a ban on one named thing, such as "Never mock React or its hooks".
- **State the rule, then show one example.**
- **Make every link say what it's for,** or when to read it.
- **Keep every heading when you rewrite a document.** Other documents link to its headings' anchors.

## Keep the meaning

A rewrite for brevity changes words, never rules. Check each rule against its old text for these changes:

- **A permission that became an instruction,** such as "`vi.fn()` is fine" becoming "Use `vi.fn()`".
- **A description that became an instruction,** such as "The browser is installed by setup" becoming "Install the browser".
- **A ban that grew or shrank,** such as a ban on one reason for a parameter becoming a ban on every parameter but one.
- **A condition that fell off its rule,** such as "once the section says it's worth it" disappearing when a sentence is split.
- **A qualifier that moved to another subject,** such as one that described one item coming to describe the whole list.
- **An instruction that now contradicts its neighbour,** often because a description was made an imperative.

Put each rule's old meaning back in its new words. Change a rule's meaning only when the owner asks, and record the change in the document's sidecar, as [Single source of truth](single-source-of-truth.md#reasons-live-in-a-metamd-sidecar) says.

## Reviewing a document

1. **Measure it** with a script that applies the counting rule above, and list every sentence over 25 words.
2. **Rewrite it,** following [the rules](#rules), one section at a time.
3. **Have someone who didn't write the rewrite compare old and new, rule by rule,** for the changes [Keep the meaning](#keep-the-meaning) lists. A subagent given both texts can do it.
4. **Fix what the comparison finds,** then measure again.
5. **Run `npm run lint`,** which checks links and anchors.
6. **Update any document that quotes a bold rule name you changed.** Find them with `git grep -n "<name>"`.
7. **Record the pass in the document's sidecar:**
   - who asked;
   - what changed;
   - what the comparison found.

## Changing this document

The reasons for these rules and their sources are in [clarity-and-brevity.meta.md](clarity-and-brevity.meta.md). Read it only when changing or questioning a rule here.
