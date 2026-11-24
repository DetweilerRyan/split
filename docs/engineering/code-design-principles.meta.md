# Code design principles: reasons and sources

Where the [code design principles](code-design-principles.md) come from, why they're written the way they are, and the decisions behind their rules. Read this only when changing or questioning a principle. Following them needs nothing from this file.

## The document

- **Asked for on [#110](https://github.com/DetweilerRyan/split/issues/110),** after research in a session on 2026-11-24 into six ideas the code already followed. The owner's choices are [recorded there](https://github.com/DetweilerRyan/split/issues/110#issuecomment-7140900477):
  - **"a code design principles doc that has a read trigger when an agent is reading or writing code. the readmes should largely be treated as overview and as an index with read triggers for each file in it's index".** So the engineering index's "Code style" section, from #83, moved here, and so did this sidecar, which was the index's.
  - **"make all four instructions",** after the six ideas were merged into four, so "that all of the material aspects of each principle be included in the new documentation but i don't want ambiguity to arrise from redundency".
- **Consolidated on [#115](https://github.com/DetweilerRyan/split/pull/115),** at the owner's request to "simplify and consolidate any mentions of these new principles from other docs into the new one". Each general statement now lives here, and the other documents keep their specific rules with a link:
  - **The lookup-table rule** moved from [`crap.md`](crap.md)'s responding steps to _least power_, with its line that a table of plain values is data. `crap.md` keeps the CRAP-specific half: oxCrap counts the move, so it doesn't pass.
  - **[Testing conventions](testing-conventions.md#replacing-external-dependencies)' rule for passing a dependency in** links to _core and shell_, which asks it of code that decides with no cost clause. Its example, `useActiveIdentity` taking only the provider's `setIdentity`, became _core and shell_'s "holding only what the code uses". Its "where it costs little" stays there, for other new code that neither decides nor is a hook, since code layout makes hooks take their effects unconditionally. The consolidation first deleted it, which would have dropped that rule without the owner deciding to.
  - **[Code layout](code-layout.md)'s hook rule** links to _core and shell_, and says its own rule, from #93, is stricter: a hook takes its effects as arguments even when it only wraps the provider.
- **Not the `code-conventions.md` that #43 turned down** ([types and schemas' sidecar](types-and-schemas.meta.md)). That would have gathered rules; this holds only principles, and each rule stays in the document that owns it, which a principle links to.

## Where each principle comes from

Six ideas, merged into four where they said the same thing, so each has one home, and two more added after a second round of research.

| Principle                                             | From                                                                                                                                   |
| :---------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Essential logic apart from the machinery around it | Functional core, imperative shell; domain-driven design's isolated domain; Out of the Tar Pit's separation of essential and accidental |
| 2. State minimal, immutable and contained             | "Stateless first"; Out of the Tar Pit on state                                                                                         |
| 3. The least powerful construct                       | The rule of least power                                                                                                                |
| 4. Complexity only when a use needs it                | Progressive complexity; essentialism; the owner's "avoid hasty abstractions"; Matt Pocock on seams                                     |
| 5. A small interface over a lot of behaviour          | John Ousterhout's deep modules, as Matt Pocock applies them to agents                                                                  |
| 6. Types that rule out impossible states              | "Make illegal states unrepresentable"; "parse, don't validate"                                                                         |

- **Functional core, imperative shell:** Gary Bernhardt's [screencast](https://www.destroyallsoftware.com/screencasts/catalog/functional-core-imperative-shell) and his 2012 "Boundaries" talk, and notes on Scott Wlaschin's 2024 talk ["Moving IO to the edges of your app"](https://l-lin.github.io/architecture/functional-core-imperative-shell). The screencast says the design "often naturally allows isolated testing with no test doubles", with "an imperative shell with few conditionals, making reasoning about the program's state over time much easier".
- **Domain-driven design:** Eric Evans, [_Domain-Driven Design_](https://www.informit.com/store/domain-driven-design-tackling-complexity-in-the-heart-of-software-9780321125217) (2003), chapter 4, "Isolating the Domain". [Smart UI](https://dev.to/ielgohary/layered-architecture-and-smart-ui-domain-driven-design-by-eric-evans-part-ii-chapter-4-1il7), business logic in the UI, is the failure _core and shell_'s last rule names, and the [ubiquitous language](https://www.martinfowler.com/bliki/DomainDrivenDesign.html) is its naming rule.
  - **Fowler's [anemic domain model](https://www.martinfowler.com/bliki/AnemicDomainModel.html)** reads at first like a case against `src/domain/`'s data and functions. The critique assumes objects carry behaviour; [OO purity isn't required](https://blog.codecentric.de/en/2019/10/ddd-vs-anemic-domain-models), and Scott Wlaschin's _Domain Modeling Made Functional_ (2018) makes types plus pure functions the intended shape. That book is from the session's own knowledge; the search didn't find it. What survives of Fowler's point is the risk _core and shell_ guards against: domain logic leaking into the shell.
- **Out of the Tar Pit:** Ben Moseley and Peter Marks (2006), after Fred Brooks's "No Silver Bullet" (1986). Essential state and logic are the users' problem itself, everything else is accidental, and state, in the authors' belief, is "the single biggest remaining cause of complexity in most contemporary large systems" ([paper](https://curtclifton.net/papers/MoseleyMarks06a.pdf); [summary](https://www.recurse.com/blog/51-paper-of-the-out-of-the-tar-pit), [notes](https://matkosoric.github.io/essay/out-of-the-tar-pit)). _Core and shell_'s test, "whether the rule would exist with no React, no Yjs and no network", is this document's adaptation of its essential/accidental split, with UI and outside services as the paper's separate part for interfaces to the outside world, and storage, which the paper counts as accidental, kept with them as needed machinery, and _contained state_'s "don't store a value you can compute" is its rule against accidental state that's derived from other state.
- **Stateless first:** no source names it as a principle. The nearest is stateless service design, as in AWS's [Well-Architected framework](https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_mitigate_interaction_failure_stateless.html), which asks that systems "either not require state, or should offload state", so the state that must persist is offloaded rather than removed. So _contained state_ keeps long-lived state in the shell rather than banning it.
- **The rule of least power:** Tim Berners-Lee's [Principles of Design](https://www.w3.org/DesignIssues/Principles) (1998), part of his Design Issues notes, which the TAG's finding cites as "Axioms of Web Architecture",, formalised by the W3C Technical Architecture Group as [The Rule of Least Power](https://www.w3.org/2001/tag/doc/leastPower.html) (2006): the more a language can do, the harder it is to tell what a program in it does. The rule against moving branches into a lookup table, a table of functions or a membership test, is the owner's, from #81 and #82.
- **Progressive complexity:** Krzysztof Cwalina's ["progressive APIs"](https://learn.microsoft.com/en-us/archive/blogs/kcwalina/book-progress-and-progrssive-apis), and Lea Verou's ["In the economy of user effort, be a bargain"](https://lea.verou.me/blog/2025/user-effort/), on Alan Kay's "simple things should be simple, complex things should be possible". It's _earned complexity_'s rule to default each option to what most callers want.
- **Essentialism:** Greg McKeown's book, as practitioners apply it to software: start simple and evolve ([DZone](https://dzone.com/articles/what-is-essentialism-and-how-does-it-make-software-more-efficient)).
- **Avoid hasty abstractions:** the owner, on [#108](https://github.com/DetweilerRyan/split/pull/108#issuecomment-7138995165): "let's avoid hasty abstractions by isolating and encapsolating early/immature decomposed logic/behaviour locally". It echoes Kent C. Dodds's [AHA Programming](https://kentcdodds.com/blog/aha-programming) and Sandi Metz's [The Wrong Abstraction](https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction): "duplication is far cheaper than the wrong abstraction".

- **Matt Pocock on seams:** "One adapter means a hypothetical seam. Two adapters means a real one" ([codebase-design skill](https://www.aihero.dev/skills-codebase-design)). The owner asked for it to be folded into _earned complexity_'s test for an injection point.

### Added on #115

At the owner's request, after research on 2026-11-24 into Kent C. Dodds, Uncle Bob, agentpatterns.ai and Matt Pocock: "yes, add 5 and 6 and fold in Pocok's seam wording" ([recorded](https://github.com/DetweilerRyan/split/pull/115#issuecomment-7141646823)).

- **_Deep modules_:** John Ousterhout, _A Philosophy of Software Design_ (2018), from the session's own knowledge. Matt Pocock, in [How to make codebases AI agents love](https://www.aihero.dev/how-to-make-codebases-ai-agents-love), says a codebase, "way more than your prompt or your `AGENTS.md` file, is the biggest influence on AI's output", and describes a deep module as "lots of implementation controlled by a simple interface". From his [codebase-design skill](https://www.aihero.dev/skills-codebase-design):
  - **The deletion test:** if the complexity disappears with the module, it was a pass-through; if it reappears across the callers, it was hiding real complexity.
  - **"The interface is the test surface".**
  - **An interface includes its invariants, ordering constraints and error modes,** not only its types.
- **The definition of a deep module** moved here from [testing conventions](testing-conventions.md#feature-contracts-for-deep-modules) at the owner's request: "i'd rather have testing-conventions.md link to princple 5 in this doc". Testing conventions keeps how a deep module is tested, and that whether one is deep is the owner's call. The definition is general because the owner asked, in [review on #66](https://github.com/DetweilerRyan/split/pull/66#discussion_r4668015827), for more than the first draft's dev tools:
  - "make it clear that not all deep modules are dev tools";
  - "in the future some deep modules may be a simplified abstraction of encapsulated complex code who's bdd tests can't necessary be run e2e".
- **The deletion test isn't the deep-module decision.** It asks whether any module earns its place. Whether a module is deep, so that its contract gets features, stays the owner's call, as the owner said on #66: "in lieu of measuring the complexity ratio we'll just have to leave the deep module distinction to a judgment call made by the owner with input from an agent".
- **Errors that say what to do,** in _deep modules_: agentpatterns.ai's [harness engineering](https://www.agentpatterns.ai/training/copilot/harness-engineering/) says Copilot "reads the error message literally and attempts the fix it suggests", so the message decides whether it corrects itself; applying that to any agent is this document's reading. The page contrasts "Use `AppError` from `src/errors/` instead of raw `Error`" with "Unexpected error throw". Jakob Nielsen's ninth usability heuristic says the same of error messages for people: they should "precisely indicate the problem, and constructively suggest a solution" ([Nielsen Norman Group](https://www.nngroup.com/articles/ten-usability-heuristics/)). oxCrap's findings and the repository's lint plugins already work this way.
- **_Honest types_:** "make illegal states unrepresentable" is Yaron Minsky's phrase, from [Effective ML Revisited](https://blog.janestreet.com/effective-ml-revisited/), where a record of optional fields becomes one variant per state; he has said he coined the phrase, but "the idea is of course much older" ([quoted by Kent C. Dodds](https://kentcdodds.com/blog/make-impossible-states-impossible)). "Parse, don't validate" is Alexis King's [essay](https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/) of 2019: a parser "consumes less-structured input and produces more-structured output", at "the boundary of your system". The flag-argument rule is mostly Martin Fowler's [Flag Argument](https://martinfowler.com/bliki/FlagArgument.html), with its exception: a boolean passed through from data, such as a checkbox's value, "has some justification". Fowler's alternatives are separate methods, a private flag method behind them, or working the choice out from the data; taking a member of a union instead is this document's own option. Using a union even for two cases is this document's reading of the owner's request on #115, to avoid booleans in favour of discriminator fields, not a source's; it's scoped to a value's state or kind, so plain yes-or-no facts stay booleans. Types and schemas' brands, parsed once where an id enters, already applied the second half.
- **_Honest types_ is enforced, in part, since [#119](https://github.com/DetweilerRyan/split/issues/119):** `noUncheckedIndexedAccess` in `tsconfig.json` types an indexed read as possibly `undefined`, which it is whenever the index is missing, and `typescript/no-non-null-assertion` in `.oxlintrc.json`, outside tests, stops a `!` claiming the value anyway. How to handle such a read is in [types and schemas](types-and-schemas.md#indexed-reads-and-), and the decision behind both in [its sidecar](types-and-schemas.meta.md#indexed-reads-and-).
- **Already covered, so not added:** Kent C. Dodds's [AHA](https://kentcdodds.com/blog/aha-programming) ("Avoid Hasty Abstractions") and [colocation](https://kentcdodds.com/blog/colocation), which are _earned complexity_; Uncle Bob's Dependency Rule, "Source code dependencies must point only inward, toward higher-level policies" ([Clean Architecture](https://www.informit.com/articles/article.aspx?p=2832399)), which is _core and shell_ with dependency direction; and agentpatterns.ai's directory structure as architecture, which is code layout with the rev-dep rules.
- **Turned down, as each conflicts with a decision here:**
  - **The Boy Scout Rule,** "leave the code cleaner than you found it", against the document's rule not to reshape code a task doesn't touch, and the over-application that [Evaluating AGENTS.md](https://agentpatterns.ai/instructions/evaluating-agents-md-context-files/) warns of.
  - **DRY as a rule,** which AHA warns against applying dogmatically, and _earned complexity_'s "two similar pieces of code are cheaper than the wrong shared one".
  - **Small functions, or a length limit,** such as harness engineering's "Functions must not exceed 50 lines". [`crap.md`](crap.md) splits a function only where the split reads better, and oxCrap measures complexity instead.
  - **Role-suffix naming,** such as `*.service.ts` and `*.repository.ts`, from harness engineering. It groups code by technical role, which cuts across code layout's colocation with the module it serves.
- **SOLID** was first turned down for its object-oriented framing. The owner pushed back: "the principles may be commonly described in OOP terms but they apply outside of OOP and are particiularly relevant with the proper and advanced use of typescript interfaces". So each letter went into the principle it sharpens, named in a parenthesis there, since a model already knows them by name:
  - **Single responsibility** is _deep modules_', in Robert Martin's own reading: "Gather together the things that change for the same reasons. Separate those things that change for different reasons", because "the reasons for change are _people_" ([The Single Responsibility Principle](https://blog.cleancoder.com/uncle-bob/2014/05/08/SingleReponsibilityPrinciple.html), 2014). His example is an `Employee` class whose pay, hours report and database code are asked for by the CFO's, COO's and CTO's people, so they belong apart. _Clean Architecture_ puts it as "a module should be responsible to one, and only one, actor" ([Wikipedia](https://en.wikipedia.org/wiki/Single-responsibility_principle)). He scopes it to modules. _Clean Architecture_, [chapter 7](https://www.oreilly.com/library/view/clean-architecture-a/9780134494272/ch7.xhtml), keeps "A function should do one, and only one, thing" as a separate rule. That the book then says this isn't the single responsibility principle is from the session's own knowledge of it, not a page read.
  - **Liskov substitution** is _deep modules_' too, read for structural types: anything that implements an interface keeps the contract its callers rely on, as Matt Pocock's interface includes invariants and error modes. Liskov and Wing require the whole specification, so letting a test's fake keep only the part the code under test relies on is this document's narrowing; a fake of a `Pick`ed interface keeps all of it.
  - **Interface segregation and dependency inversion** are _core and shell_'s, and they're different things. Interface segregation is depending on no more than the code uses, as `useActiveIdentity`'s `Pick<RoomProvider, 'setIdentity'>` does. Dependency inversion is about who owns the interface, and what it depends on: "High-level modules should not import anything from low-level modules", "Abstractions should not depend on details", and "the abstracts are owned by the higher/policy layers" ([Wikipedia](https://en.wikipedia.org/wiki/Dependency_inversion_principle)). `useExchangeRate`'s `FetchRate` is an example: the hook declares it in its own terms and imports nothing from `src/services/`, and `RoomView` passes in `getExchangeRate`. The first draft credited the `Pick` to both, and the second named `useIdentity`'s `IdentityProvider`, which the final check found is built from `src/sync/`'s own types and imports them, so it inverts ownership but not dependency.
  - **Open-closed** is in _deep modules_ too, and [Open-closed against least power](#open-closed-against-least-power) says why it reads that way.

### Names, and the owner's review on #115

- **Each principle has a name,** at the owner's request ([comment](https://github.com/DetweilerRyan/split/pull/115#discussion_r4685752566)): "i like that the title for each principle is a command. i also know that referring to the principles via their title (the full command is cumbersome). I'm also not a big fan of referring to principles by their number alone since a number does not invoke the meaning of the principle on it's own." The numbers and the commands stay.
  - **Each name is short, and established where a term exists,** so it brings in what a model already knows: _core and shell_ is functional core, imperative shell; _least power_ is the rule of least power; _deep modules_ is Ousterhout's. _Contained state_, _earned complexity_ and _honest types_ name the rest by what they ask.
  - **References use the name,** in this sidecar and in the documents that link here, not the number.
- **Single responsibility, corrected** ([comment](https://github.com/DetweilerRyan/split/pull/115#discussion_r4685671079)): "the single responsibility principle is difficult to get right. do some web research on it". The first wording's test, "if you can't name its concern without 'and', it has two", was "do one thing", a common misreading. It's now Martin's: what changes for the same reasons, gathered, and the reasons are whoever asks for the change. The sources are above, under SOLID.
- **Booleans and discriminator fields** ([comment](https://github.com/DetweilerRyan/split/pull/115#discussion_r4685631354)): "id add in the bit about avoiding Booleans and the use of discriminator fields", then, [in reply](https://github.com/DetweilerRyan/split/pull/115#discussion_r4685696420), "maybe my recommendation belongs in principle 6 instead of here. your call". It went in _honest types_, beside the union rule it extends, and _least power_'s `switch` rule refers to it by name:
  - a union with a named discriminator field, even for two cases, so a third needs no change of shape;
  - no flag argument: Martin Fowler's [Flag Argument](https://martinfowler.com/bliki/FlagArgument.html) prefers `regularBook(martin)` to `book(martin, false)`, since the call should say what it does.
- **`ReceiptStore`'s own bullet went** ([comment](https://github.com/DetweilerRyan/split/pull/115#discussion_r4685612935)): "i'm not sure this line is really needed here. does it materially help an agent follow this principle? is it meant to be an example?" It wasn't an example. It carried two rules from the old Code style section: another class needs the owner's approval, and a kept class has a disable. The first is a boundary, so it joined the classes rule. The second is `AGENTS.md`'s rule for any disable, and lint reports the class, so it went.

### Every point checked against its sources, on #115

At the owner's request ([recorded](https://github.com/DetweilerRyan/split/pull/115#issuecomment-7143085638)): "since you understandably got the details of the single responsibility princple wrong, can you go ever each and every point under each princple and research them to be sure that they are accurate and correct". Six fact-checkers, one per principle, read the primary sources and the code on 2026-11-24. What they changed:

- **_Core and shell_'s command no longer says "accidental machinery".** In [Out of the Tar Pit](https://curtclifton.net/papers/MoseleyMarks06a.pdf), accidental is "complexity with which the development team would not have to deal in the ideal world", such as "performance issues" and "suboptimal language and infrastructure", and the interfaces to the outside world are a separate, required part. The paper keeps the interfaces to the outside world as a separate part of its design, and puts physical storage in its accidental part: "the accidental aspects of storage". Calling UI, sync and storage "the machinery around" the essential logic, needed rather than accidental, is this document's reading, and on storage it departs from the paper. Gary Bernhardt's split is pure against impure, and his core holds UI decisions too, so the shell now keeps "decisions out of it where you can", with a machinery-only decision written as a pure function beside its shell code.
- **_Core and shell_'s example** used fields `ReceiptItem` doesn't have, and pointed to a per-item helper that would diverge from `computeReceiptMath`'s split in minor units. It now calls `computeReceiptMath`.
- **Existing code doesn't all follow the principles.** `createRoomId` calls `crypto.randomUUID()`, `localeCurrency` read `navigator` until #116 passed the language in, `RoomSnapshot` carries sync fields, and `useActiveIdentity` reads saved identities from storage directly. So the document says to follow the principle, not the nearest example.
- **_Contained state_:**
  - Tar Pit calls state "the single biggest remaining cause of complexity", beside control flow and code volume, and asks for state to be avoided and separated, so the intro says both.
  - A cached copy is allowed for speed as well as stability, rebuilt with its source, as the paper keeps derived state for performance and React's [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore) wants "a cached last snapshot".
  - The receipt's data is essential state, so only how it's stored and synced is the shell's: `ReceiptStore` turns the Yjs document, which `createProvider` gets from Liveblocks or creates, and shares, into a `RoomSnapshot`. The first wording said the document was "behind one module", which it isn't.
- **_Least power_:**
  - The [rule of least power](https://www.w3.org/2001/tag/doc/leastPower.html) is about choosing among languages for the Web, so applying it within one language is now stated as a borrowing.
  - The ranking of constructs is this document's own, building on the owner's rule from #81; no source gives it. "Dynamic dispatch" left the list, since calling an interface passed in is dynamic dispatch too.
  - A `Set`'s membership test is a branch, not data.
- **_Earned complexity_:**
  - Metz's abstraction was extracted from duplication, so the cost she names is bending it once uses stop fitting, not making it early. The intro now says that.
  - "A second caller" is now one that needs the same behaviour. That threshold is this document's own: the [rule of three](<https://en.wikipedia.org/wiki/Rule_of_three_(computer_programming)>) waits for three instances of similar code, and AHA waits "until you feel pretty confident that you know the use cases". This one is lower in count, and stricter in kind.
  - Pocock counts a test's fake as an adapter.
  - YAGNI doesn't apply to refactoring ([Fowler](https://martinfowler.com/bliki/Yagni.html)).
  - oxCrap's default is the fullest count, so options default to "what most callers want", not "the simple case".
- **_Deep modules_:**
  - The single responsibility example now names people, as Martin does, not concerns.
  - Liskov and Wing's behavioural subtyping requires the whole specification. The document lets a fake keep only the part the code under test relies on, as this repository's `vi.fn()` fakes do, and marks that as its own narrowing (above, under SOLID).
  - Protected variation, Alistair Cockburn's pattern as [Larman](https://martinfowler.com/ieeeSoftware/protectedVariation.pdf) reads it, is about predicted variation, so "two or more implementations" is marked as this document's narrowing, from Pocock, with a test's fake counting. The caution against protecting what may never vary is Larman's own: "Sometimes, the cost of speculative future proofing to achieve these goals outweighs the cost incurred by a simple, highly coupled 'brittle' design that is reworked as necessary in response to true change pressures."
  - A pass-through is removed, so callers use what it wraps. Pocock's deletion test only finds a pass-through; the fix is from Ousterhout's _A Philosophy of Software Design_, which offers exposing the lower module to callers as one of three fixes, with moving the work and merging the modules. That's from the session's own knowledge of the book, not a page read. The first wording, "fold it into its caller", was the merging one.
  - The precedence between least power and deep modules now splits by where a set varies, since deep modules moves even a closed set when its `switch` recurs.
- **_Honest types_:** the flag-argument rule keeps Fowler's exception, the two-case union rule is scoped, and the "wrong" example's fields are readonly, so it shows one fault, not two.

- **A final round,** by three fresh fact-checkers on 2026-11-24, at the owner's request: "run one final round of checks to confirm your rewrites". It found:
  - `useIdentity`'s `IdentityProvider` wasn't dependency inversion;
  - the state rule covered UI state that lives in hooks;
  - the "wrong" example's comment didn't match its code;
  - a gap on tables of plain values;
  - a misquotation of Out of the Tar Pit;
  - stale or overstated lines in this sidecar, on the rule of three, Liskov, Ousterhout, Repeated Switches and the precedence.

  Each is corrected above.

- **A third round,** by three more fresh fact-checkers on 2026-11-24, at the owner's request: "run another fresh round". It found:
  - in the document:
    - the state rule would have moved `src/services/`'s exchange-rate cache into `src/sync/`;
    - "pass effects in" read as unconditional;
    - Tar Pit's belief was stated as fact;
    - "never in place of branches" contradicted the new allowance for a `switch` that only picks a plain value;
    - the two "second implementation" triggers were worded differently;
  - in this sidecar:
    - a draft W3C link;
    - AHA said to argue against DRY;
    - a registry called "the usual way";
    - an unsourced "ceremony, not design";
    - Pocock credited with Ousterhout's fix;
    - Larman's "essentially equivalent" overstated;
    - the union option credited to Fowler;
    - a misquotation of the document.

  Each is corrected above.

- **A fourth round,** by three more fresh fact-checkers on 2026-11-24, at the owner's request: "another fresh round". It found six problems.
  - **In the document:** "the rest is tested with plain fakes", against testing conventions' rule to fake only what can't run.
  - **In this sidecar:**
    - AWS's page never says "hybrid";
    - the screencast says "often" about test doubles, and the Wlaschin link is notes on his talk;
    - Tar Pit's belief was still stated as fact here, and its classification was said to be this document's test;
    - refactoring.guru was credited with 8th Light's point;
    - _Clean Architecture_'s "do one thing" rule had no source for its quotation.

  Each is corrected above.

- **A fifth round,** by three more fresh fact-checkers on 2026-11-24, at the owner's request: "run another one". It found ten problems.
  - **In the document:** the trigger "a second implementation lives outside the module" didn't say of what. A test's fake of `RoomProvider` already lives outside its module, so it now says "of those cases".
  - **In code layout:** the hook rule credited _core and shell_ with a rule it doesn't make. Code layout's own rule, from #93, is stricter, and now says so.
  - **In this sidecar:**
    - Dodds's AHA and colocation were cited to a podcast summary that mentions neither;
    - Larman's condition for applying protected variation was quoted as his caution against it;
    - the document's own narrowing of repeated switches carried the sources' citations;
    - Fowler's alternatives to a flag argument were understated;
    - Martin's `Employee` is a class;
    - core and shell's snippet isn't invented;
    - Tar Pit was credited with this document's reading of the UI and sync;
    - the shell rule was described as it first read.

  Each is corrected above.

- **A sixth round,** by three more fresh fact-checkers on 2026-11-24, at the owner's request: "run another one". It found nothing wrong in the document, and seven problems in this sidecar:
  - Tar Pit does name storage, as accidental;
  - two lines described code layout's hook rule as it read before the fifth round;
  - `createProvider` gets the Yjs document from Liveblocks when it's configured;
  - the sources on repeated switches don't mention modules at all;
  - oxCrap adds 1 for a call through a registry;
  - harness engineering's "reads the error message literally" is said of Copilot.

  Each is corrected above.

- **A seventh round,** by three more fresh fact-checkers on 2026-11-24, at the owner's request: "keep running rounds until the sidecar is clean". It found nine problems in this sidecar, and none in the document:
  - the plan's wording on #83 was quoted as the owner's;
  - the plugin's size was understated;
  - the Tar Pit quotation was cited to pages without it;
  - Pocock's subject is the codebase, not its design;
  - `createProvider` uses several conditions;
  - protected variation is Cockburn's pattern;
  - "prefer plain data to code" isn't the document's wording;
  - agentpatterns.ai's subject is instruction-tuned models;
  - its "treat every instruction" is the page's explanation of what the studies measured.

  Each is corrected above.

- **An eighth round,** by three more fresh fact-checkers on 2026-11-24. It found nine problems in this sidecar, and none in the document:
  - the plugin imports a type;
  - two more places took the #83 plan's wording for the owner's;
  - the owner's #81 rule covers membership tests too, and was quoted in the agent's words;
  - the entry on injection points contradicted the one beside it;
  - InfoQ's "a bit overstated" was shortened;
  - a pointer named the wrong section;
  - System Prompt Altitude's "gives the agent no real constraint" lost "the agent".

  Each is corrected above.

- **A ninth round,** by three more fresh fact-checkers on 2026-11-24. It found five problems in this sidecar, and none in the document:
  - `max-classes-per-file` can be set to 0, and the real gap is that it can't exempt an `Error` subclass;
  - the owner never ruled out a dependency on #83, whose plugin didn't load;
  - "Lookups and Set.has" was chosen on #81, not #82;
  - oxCrap also counts a table added to at a file's top level;
  - a union for two cases was this document's reading of the owner's request, not the request.

  Each is corrected above.

- **A tenth round,** by three more fresh fact-checkers on 2026-11-24. One of its three parts came back clean. It found four problems in this sidecar, and none in the document:
  - the test was quoted in a recorded comment's words, not the document's;
  - a link to `oxcrap.meta.md` went to the section on #81's rule, not the one on plain values;
  - the owner's request for the open-closed research had never been recorded on #115, so it now is;
  - "above plain code" read as the reverse of _least power_'s order.

  Each is corrected above.

- **An eleventh round,** by three more fresh fact-checkers on 2026-11-24. One of its three parts came back clean. The other two found one problem, the same one, in this sidecar: the late record of the owner's request for the open-closed research had never been posted, because the command that posted it failed, and the link went to another comment. The record is now [posted](https://github.com/DetweilerRyan/split/pull/115#issuecomment-7144965111), and the link points to it.
- **A twelfth round,** the last, by three more fresh fact-checkers on 2026-11-24, after the owner's "you can stop after this round". One of its three parts came back clean. It found three problems in this sidecar, and none in the document:
  - Berners-Lee's page is titled "Principles of Design";
  - _least power_ refers to _honest types_ by name, not by a link;
  - the owner's second review comment was linked to the first.

  Each is corrected above.

### Open-closed against least power

Researched on 2026-11-24, at the owner's request, "do some web reserach on the push and pull of O vs princple 3" ([recorded late](https://github.com/DetweilerRyan/split/pull/115#issuecomment-7144965111)). Decided ([recorded](https://github.com/DetweilerRyan/split/pull/115#issuecomment-7141937446)): "yes, write it into 115 that way. i'd also soften the ban on a lookup registry. it's use should be rare becuase it's inherit complexity is high (it's very dynamic at runtime) so the complexity of the probelm should be sufficient to nececitate it".

- **They pull apart because of the expression problem.** Philip Wadler named it in [1998](https://homepages.inf.ed.ac.uk/wadler/papers/expression/expression.txt): code extends by new cases or by new operations, and no ordinary design makes both cheap ([Wikipedia](https://www.wikipedia.org/wiki/Expression_problem), [Eli Bendersky](https://eli.thegreenplace.net/2016/the-expression-problem-and-its-solutions/)). A union with a `switch` makes a new operation one function and a new case an edit to every `switch`. An interface makes a new case one implementation and a new operation an edit to every implementation. Open-closed picks the new-cases axis.
- **Open-closed read as protected variation.** Bertrand Meyer's 1988 principle was about implementation inheritance, and Robert Martin's 1996 reading about abstract interfaces. Craig Larman, in [IEEE Software](https://martinfowler.com/ieeeSoftware/protectedVariation.pdf) (2001), argued that open-closed is "essentially equivalent" to Alistair Cockburn's protected variation: find the points of predicted variation, and put a stable interface around them ([Wikipedia](https://www.wikipedia.org/wiki/Open/closed_principle)). Jon Skeet [argued](https://codeblog.jonskeet.uk/2013/03/15/the-open-closed-principle-in-review/) that protected variation is the clearer statement, and Martin conceded that his definition was "a bit overstated" ([InfoQ](https://www.infoq.com/news/2013/05/open-closed-principle-challenged)). Read that way, it asks for an interface where variation is real, which _earned complexity_'s seam test decides: "predicted" variation is narrowed to variation that's there.
- **The trigger to move a `switch` to an interface is repetition.** Fowler's _Refactoring_ (2nd edition) renamed the smell "Repeated Switches" ([InformIT](https://www.informit.com/articles/article.aspx?p=2952392&seqNum=12)): the same conditional switching logic in several places, not one `switch`. This document narrows that to two or more modules, so a `switch` repeated within one module stays; that narrowing is its own: the sources speak of the same switch in different places, with no limit to separate modules. [8th Light](https://8thlight.com/insights/conditionals-arent-evil-unless-you-duplicate-them) makes the general point, that a single conditional is fine and a duplicated one isn't: "A change to one of the duplicated conditionals means changing all of the others." [refactoring.guru](https://refactoring.guru/smells/switch-statements) names scattered copies of one `switch` as a cause, and leaves a `switch` that "performs simple actions" alone; this document's own view is that replacing a single stable `switch` with a hierarchy adds ceremony, not design.
- **In TypeScript, a closed set you own suits a union and an exhaustive `switch`.** A `never` check makes the compiler list every `switch` a new case must reach, so editing them is safe ([TkDodo](https://tkdodo.eu/blog/exhaustive-matching-in-type-script); [typescript-eslint's `switch-exhaustiveness-check`](https://typescript-eslint.io/rules/switch-exhaustiveness-check/)). An open set that others extend suits an interface or a registry ([discriminated unions over subclasses](https://dev.to/gabrielanhaia/the-strategy-pattern-in-typescript-discriminated-unions-beat-subclasses-17na)).
- **Why the registry is allowed but rare:** the usual way to make a `switch` open-closed is polymorphism, Fowler's "Replace Conditional with Polymorphism": an interface, with no keyed lookup. Another way is a registry, a table of handlers keyed at run time. That's a lookup table of functions, which #81's rule had banned outright, so the interface comes first. The owner then softened the ban: a registry is among the most dynamic constructs, so it needs a problem complex enough to need it, such as cases added at run time by code the module can't know about. The comment beside one says why nothing weaker works, so a reviewer can check the claim. oxCrap doesn't count a registry filled at run time, since it [counts only](../../scripts/oxcrap/README.md#how-oxcrap-scores) a module-level table built from literals or added to at the top level, and a table any function changes is state, beyond adding 1 for a call through a computed member, so the comment is the real check.
- **`RoomProvider` shows both sides,** in `src/sync/yjsProvider.ts`. Callers depend on its interface, which tests fake, so they don't change when the backend does. Inside `createProvider`, plain conditions on one closed choice pick Liveblocks or WebRTC from a closed set. The first wording said it "does both", which a review found wrong: it has one real implementation, and no `switch` that recurs.
- **The loophole the review found:** narrowing the lookup-table rule to "to shorten it" let an agent over the CRAP limit call its table a registry. So _least power_ names the CRAP limit, and "whether or not it's called a registry". Both halves of the snippet, each a whole function, were compiled on 2026-11-24 with the repository's TypeScript, with `addItem` and `removeItem` taking the whole `Action` (typed for one case each, the "wrong" half fails to compile, which is another of its faults), and a copy of the `switch` missing a case fails with "is not assignable to type 'never'". The first version wasn't a function, so it didn't compile as written.

## Where two principles meet

- **1 over 4 for a business rule** was already [code layout](code-layout.md)'s rule: a business rule goes in `src/domain/` "even when only one component uses it today". Without the precedence, _earned complexity_'s "beside its one user" would contradict it.
- **Passing an effect in isn't an injection point.** _Core and shell_, and testing conventions for other new code "where it costs little", ask for an effect to be passed in as an argument. _Earned complexity_ limits injection points, which swap a whole part. Without that line, a review found three different thresholds for injecting something. `RoomView`'s `parts` are the owner's exception on #93, so they're named as that, not as an example to copy.
- **_Least power_ and _earned complexity_ don't conflict on injection points.** _Least power_ ranks an interface passed in after plain data, a pure function and a `switch`, and before a registry. When it swaps a whole part, it's an injection point, and _earned complexity_ says when one is needed: a test or a second caller. Passing an effect in is _core and shell_'s, as the entry above says.
- **_Least power_'s lookup-table rule covers tables of functions and membership tests,** not only tables of functions. The owner's rule, on #81, was that moving a `switch` "into a runtime data structure is never the right solution", and on #81 the owner chose that oxCrap count "Lookups and Set.has", and on #82 that a table of plain values counts nothing, so it counts both. A table of plain values read for its value is data, which oxCrap's README says "adds nothing", so a `switch` that only picks a value may become one; [`oxcrap.meta.md`](../../scripts/oxcrap/oxcrap.meta.md#lookup-tables-dont-lower-a-score) has the #81 rule, and [Lookup tables count](../../scripts/oxcrap/oxcrap.meta.md#lookup-tables-count) the decision on plain values. So _least power_'s preference for declarative config and plain data over code stops short of replacing branches. On #115 the owner softened it for one case, the registry, as [Open-closed against _least power_](#open-closed-against-least-power) says. Turning a `switch` into a table to shorten it, or to pass the CRAP limit, is still ruled out.
- **_Least power_ and _deep modules_ split a set of cases by where it varies:** a closed set handled in one module stays a `switch`, and one whose `switch` recurs across modules, or with a second implementation of those cases outside the module, becomes an interface. So open-closed and _least power_ each have their own ground, and neither is an exception to the other. The first wording split by whether the set is closed, which contradicted _deep modules_' own rule.
- **Functions over classes is _contained state_'s,** not _least power_'s, though the owner's reason on #81 touches both: "stateful OOP" is about state, and "less dynamic" about power. One home keeps it from being stated twice.

## Earned complexity's enforcement

- **"Keep code beside its one user" is checked for the shared UI folders.** `npm run lint` fails a module in `src/components/` or `src/hooks/` that isn't imported from two or more folders, leaving tests out, since #118. What counts as a user, and why, is in [code layout's sidecar](code-layout.meta.md#shared-folders-are-checked).
- **The rest is review's.** Whether a layer, option, parameter or injection point has a current use is judgment no tool here measures.

## How the document is written

Researched on [agentpatterns.ai](https://agentpatterns.ai/instructions/) on 2026-11-24, at the owner's request, "to make sure that agents are not overly encoumbered by vegue rules and that as the agent models grow more powerful they remain empowered with clarity from the docs". These are the site's summaries of the studies it cites, not the studies themselves.

- **Principles with a test and a reason, not lists of cases.** From [System Prompt Altitude](https://agentpatterns.ai/instructions/system-prompt-altitude/):
  - the right altitude "tells the agent how to reason, not what to decide for each case";
  - instruction-tuned models "apply stated reasoning to novel inputs rather than pattern-matching enumerated cases";
  - a vague instruction "gives the agent no real constraint", so the model falls back on its defaults.

  So each principle has a concrete test and its reason in a clause, and none says only "write clean code".

- **Only what an agent wouldn't do anyway.** [Evaluating AGENTS.md](https://agentpatterns.ai/instructions/evaluating-agents-md-context-files/): "remove everything the agent can already infer, and keep only what it cannot". So the document doesn't explain the theory behind each idea, which models know. It says what each means here: the test, the folders, and which principle wins.
- **Few instructions.** The same Altitude page cites instruction-following research (arXiv 2507.11538): "even the best frontier models reach only 68% accuracy at a density of 500 instructions". So the document has six principles and three precedence rules. The detailed rules stay in their own documents, read when their trigger fires.
- **A snippet over a paragraph.** [AGENTS.md Design Patterns](https://agentpatterns.ai/instructions/agents-md-design-patterns/): "One real code snippet demonstrating your project's conventions is more reliable than three paragraphs describing them", written as a correct and a wrong version. _Core and shell_, _least power_ and _honest types_ have one each. _Least power_'s and _honest types_' use invented names, so they don't copy code that changes; _core and shell_'s calls the real `computeReceiptMath`, so it can't drift from the domain's split.
- **Hard boundaries enumerated, judgment left as principle.** Altitude: "For hard boundaries, enumerate the boundary explicitly even if you also state the principle." The hard boundaries here, no classes, readonly types and the layers, are rules that lint enforces, owned by their documents.
- **Scoped to the code a task touches.** The studies Evaluating AGENTS.md reports found agents "running more tests, reading more files, and searching more than the task required", which the page explains as agents that "treat every instruction as equally important". So the document says not to reshape other code to fit the principles unasked.
- **Every vague word given a test.** A fresh-context review of the first draft found "a thin shell" and "as few decisions as it can" with nothing to check them against. So the shell was then defined by _core and shell_'s own test, which a later round changed to keeping decisions out of the shell where it can, with a machinery-only decision written as a pure function beside its shell code. The same review found two false claims, about oxCrap and about doubles, and five restated rules, which were cut or became links. A second review found that the new "don't store what you can compute" rule contradicted `ReceiptStore`'s cached snapshot, so it now names that exception.
- **Reasons in the document, a clause each.** [Single source of truth](../prose/single-source-of-truth.md#reasons-live-in-a-metamd-sidecar) keeps reasons in sidecars, "beyond a clause where a rule would be unclear without one". A principle is that case: Altitude's point is that the stated reason is what lets a model apply it to a new case.

## Functions, not classes or `this`

- **The owner's reason,** on [#81](https://github.com/DetweilerRyan/split/pull/81#discussion_r4671675741), 2026-11-23: "i'm not a big fan of using stateful OOP when largely pure functional approaches result in simpler and less dynamic and therefore less error prone runtime execution." oxCrap's walks became functions on that pull request; [`oxcrap.meta.md`](../../scripts/oxcrap/oxcrap.meta.md) records what that cost.
- **The owner's decision,** on [#83](https://github.com/DetweilerRyan/split/issues/83#issuecomment-7122175097), 2026-11-24, approved the plan for a small local oxlint JS plugin, with no new dependency, that bans classes, except `Error` subclasses, and `this`, and chose "Convert all but ReceiptStore". oxCrap's `Run` and both screenplay `Actor`s became functions in the same change.
- **Why a local plugin:** none of oxlint's built-in rules bans every class but an `Error` subclass, or every `this`: `max-classes-per-file` set to 0 bans every class but can't exempt an `Error` subclass, and reports the file rather than each class, `oxc/no-this-in-exported-function` covers exported functions only, and oxlint has no `no-restricted-syntax`; and [`eslint-plugin-functional`](https://github.com/eslint-functional/eslint-plugin-functional), which #83 started from, doesn't load under the repository's TypeScript 7 and carries an unfixed high advisory, so the plan the owner approved adds no dependency. The plugin was two short rules, in about 140 lines of one file, and #116 added a third, `functional/no-module-let`, which [the checks below](#checks-that-enforce-the-principles) describe. It's written against oxlint's [JS plugin API](https://oxc.rs/docs/guide/usage/linter/writing-js-plugins.html), which is alpha and the repository's first use of it. If a release of oxlint stops loading it, `scripts/lint/functional.real.test.ts` fails.
- **What counts as an `Error` subclass:** a class whose `extends` is a name ending in `Error`, either alone (`Error`, `RangeError`) or as the last part of a dotted path (`errors.ConfigError`). Anything else, such as `errors[name]` or `mixin(Error)`, is reported, since the rule can't tell what it names.
- **`this` is allowed inside a class, and only there,** through `functional/no-this`'s `allowInClasses` option, which `.oxlintrc.json` turns on. The owner chose it on [#103](https://github.com/DetweilerRyan/split/pull/103#issuecomment-7136861369), 2026-11-24, over a block disable for `ReceiptStore`. Since `functional/no-classes` already bans every class but an `Error` subclass and an approved one, a `this` can only read a class that's allowed to exist. That includes an `Error` subclass, which the first version banned `this` in too, on the stricter reading of the plan the owner approved on #83; oxCrap's `ParseError` and `ConfigError` still use none.
  - **What "reads its class" means:** the scope the `this` binds to is a class's method, constructor, accessor, field value or static block. An arrow function binds no `this`, so one inside a method still reads the class. A `function` binds its own, so a `this` under one is reported, as is one in a computed key, a decorator or an `extends` clause, which read the scope around the class.
  - **The option is off by default,** so the rule alone still bans every `this`, and the config is where the repository relaxes it.
- **`typeof this` in a type isn't reported,** as in `m(): typeof this` or `y: typeof this.x`. It names a type and reads nothing at run time, so it carries none of the state the rule is about. A review of the first version found it reported.
- **`ReceiptStore` keeps its class,** as the owner chose on #83, because it wraps Yjs's own stateful types, a `Y.Doc` and its `Y.Map`s, for React's `useSyncExternalStore`, which was the plan's reason.
- **Its `this` needs no disable,** since `allowInClasses` allows it. The first version disabled `functional/no-this` line by line, 57 comments, because [`AGENTS.md`](../../AGENTS.md#definition-of-done) says to disable a rule only on the line it flags. A block disable around the class was the other choice, and needed an exception to that rule. `functional/no-classes` flags one line, so it's disabled on that line alone.
- **No module boundary for `scripts/lint/`.** The plugin imports only a type from `oxlint`, and oxlint loads it by path from [`.oxlintrc.json`](../../.oxlintrc.json), so [dependency direction](dependency-direction.md) has nothing to check yet.
- **What it costs:** on 2026-11-24, `oxlint --deny-warnings` over the repository took about 380 ms without the plugin and between about 500 and 580 ms with it, the median of five runs in each of two sessions; all of `npm run lint` stayed between 2 and 2.6 s, within its run-to-run noise.

## Checks that enforce the principles

Asked for on [#116](https://github.com/DetweilerRyan/split/issues/116): the checks that cost little, because tools already installed can run them and little or no code broke them. Each is on in [`.oxlintrc.json`](../../.oxlintrc.json) or [`tsconfig.json`](../../tsconfig.json), with a comment naming its principle. The hit counts are from turning each on, on 2026-11-24.

| Principle       | Check                                                                                                                                                                                        | Hits | What was done                                                                                              |
| :-------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---: | :--------------------------------------------------------------------------------------------------------- |
| Core and shell  | `no-restricted-globals` in the `src/domain/` override: `navigator`, `window`, `document`, `location`, `localStorage`, `sessionStorage`, `indexedDB`, `fetch`, `setTimeout` and `setInterval` |    2 | Both were `localeCurrency` reading `navigator.language`. It takes the language now, and its hook passes it |
| Core and shell  | `no-restricted-properties` in the `src/domain/` override: `Date.now` and `Math.random`                                                                                                       |    0 |                                                                                                            |
| Contained state | `functional/no-module-let`, a module-level `let` or `var`, everywhere but `src/sync/`                                                                                                        |    2 | `scripts/stop-hook.ts` and `scripts/check-browser.mjs` each moved their `let` into a function              |
| Least power     | `no-eval`, `no-new-func`, and `Proxy` in `no-restricted-globals`                                                                                                                             |    0 |                                                                                                            |
| Least power     | TypeScript's `noFallthroughCasesInSwitch`                                                                                                                                                    |    0 |                                                                                                            |
| Deep modules    | `oxc/no-barrel-file`, with a threshold of 0                                                                                                                                                  |    0 |                                                                                                            |
| Honest types    | TypeScript's `exactOptionalPropertyTypes`                                                                                                                                                    |    2 | oxCrap's `merge` takes layers whose options may be `undefined`, which it already skipped                   |
| Honest types    | TypeScript's `noImplicitReturns`                                                                                                                                                             |    5 | Five `switch`es in oxCrap that fell off the end got a `default` that returns `undefined`                   |

- **`functional/no-module-let` is a rule in the functional plugin,** not a plugin of its own. It's _contained state_'s, as the plugin's other two rules are, so it shares their file, their test setup and their `jsPlugins` entry. None of oxlint's built-in rules fits: `no-var` bans every `var` and no `let`, and `prefer-const` reports only a `let` that's never reassigned.
  - **What counts as module-level:** a `let` in the module's own scope or a namespace's, exported or not, and a `var` that no function or static block holds, since a block doesn't scope a `var`. A `let` in a top-level block, such as a `for` loop's counter, lives only as long as the block. A `declare`d one, or one in a `declare namespace` or `declare global`, names a type and holds nothing.
  - **`src/sync/` is exempt** in an override, as #116 asked, because that's where the room's long-lived state lives. Nothing there had a module-level `let` when the rule was turned on.
  - **#116 counted no hits;** its count missed the two under `scripts/`.
- **The `src/domain/` override repeats `Proxy`.** An override's options for a rule replace the root's, so without it `Proxy` would be allowed in the one folder the globals ban covers.
- **Each restricted global and property carries a message** saying what to do instead, as [_deep modules_](code-design-principles.md#5-deep-modules-give-each-module-a-small-interface-over-a-lot-of-behaviour) asks of an error.
- **`oxc/no-barrel-file`'s threshold is 0.** By default it reports an `export *` only when the modules it loads pass 100, which no barrel in this repository would. At 0 it reports every `export *`.
- **`useSeedImport` takes the language as an argument,** defaulting to `navigator.language`, as [code layout](code-layout.md) asks of a hook's browser state, so its test passes `en-GB`.
- **`no-param-reassign` is left off,** as #116 decided. It flags 8 places in `src/domain/receipt/math.ts` that change working objects the function built itself, which _contained state_ allows, and the rule can't tell those from a caller's value.

### What the checks don't catch

- **A global read through `globalThis` or `self`,** such as `globalThis.localStorage`, passes the `src/domain/` ban, which names only the globals themselves. Banning `globalThis` too would flag `createRoomId`'s `globalThis.crypto.randomUUID()`, which #116 left alone.
- **`crypto`** isn't on the list, for the same reason.
- **A named re-export,** such as `export { a } from './a'`, isn't a barrel to `oxc/no-barrel-file`, which counts only `export *`. A module of only named re-exports is a pass-through that review has to catch.
- **A module-level `const` holding a mutable object,** such as a `Map` that functions change, is state too. Review has to catch it.

## No type assertions

- **Lint enforces part of _honest types_** since [#117](https://github.com/DetweilerRyan/split/issues/117): `typescript/consistent-type-assertions` reports `x as T` outside tests, since an assertion claims a type without the parse the principle asks for. [Types and schemas](types-and-schemas.md#checked-not-asserted) owns what to write instead, and [its sidecar](types-and-schemas.meta.md#checked-not-asserted) the decisions.

## What would reopen this

- **A principle an agent follows unprompted.** As models grow more capable, a principle they apply without being told becomes an instruction that only costs attention. Remove it then, and keep the rules its owning documents enforce.
- **A case a principle decides wrongly,** or two principles that pull apart in a way the precedence doesn't settle. Sharpen the principle's test, or add to the precedence, rather than listing the case.
- **A second class the owner wants to keep,** a wish to ban `this` inside an `Error` subclass again, or a class whose `this` should be reported after all.
- **oxlint's JS plugin API changing** in a way that breaks the plugin, or a built-in rule appearing that does the same job, which would replace it.
