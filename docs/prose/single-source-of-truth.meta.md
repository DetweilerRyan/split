# Single source of truth: reasons

The reasons for [Single source of truth](single-source-of-truth.md)'s rules. The rules written before this sidecar give their reasons in their own text; new reasons go here.

## Referencing code

- **Asked for by the owner on #171,** on 2026-11-27 ([recorded](https://github.com/DetweilerRyan/split/pull/171#issuecomment-7210157296)): "for the most part we need to stop referening the code in our documentation. every rule does not need to list out every place that the rule is applied in the codebase. doing so results in an ever growing driftable serffice in the documenation and creates more and more churn in the documentation. overtime, the documentation should change less and less frequently. that being said there are places in the documentation where it's relevant to reference code but do not catalog every ts file that is utilizing a rule or section from the documentation."
- **Why here:** a catalogue of code is a second copy of facts the code already holds, which is what single source of truth exists to stop. It drifts each time the code changes, as #169 showed. A container's rename and a change to its slots each meant editing the testing documents and the code design principles.
- **What counts as the point,** and so stays:
  - **the file the reader opens or changes,** since a rule about a config file can't be followed without its name;
  - **a fact the code owns,** which rule 4 already sends to the code;
  - **one example,** where a rule is unclear without it.
- **An example written in the document is preferred,** because it's under the document's control. A snippet with made-up names stays true when the code that inspired it is renamed, moved or deleted.
- **Concepts aren't code.** A list such as the services a test must never call names no file, and it sets a rule's scope, so it stays.
- **Tool documentation and sidecars are exempt.** A script's README is about that script's code. A sidecar's history records the code of its time, and rewriting it would falsify the record.
- **What the sweep on #171 kept as generic rules:** facts a removed example had carried. Examples are the `readOnly` hazard of a served JSON Schema, and the "within one module" condition on keeping a `switch`. An independent comparison found each of these when it was first cut.
- **Reopen when:** a rule can't be followed without naming more code, or a catalogue comes back because readers needed it.
