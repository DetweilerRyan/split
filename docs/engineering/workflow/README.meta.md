# Workflow index: reasons

Why the [workflow index](README.md) is laid out as it is. Read this only when changing or questioning it. Following the procedures needs nothing from this file.

- **A diagram as well as the table.** The owner suggested a state machine diagram on [#47](https://github.com/DetweilerRyan/split/pull/47#discussion_r4653488713) on 2026-11-21. The table says when to read each procedure but not how work loops between them: revising goes back through review, and a ready pull request goes back to draft. The diagram shows that. It uses Mermaid because GitHub renders it in place, with no image to keep in step.
- **The diagram shows the order, not the rules.** Each arrow's condition is a short label; the rule behind it belongs to the procedure it leaves. If a procedure changes when work moves on, update the arrow's label to match, and keep the rule in the procedure.
- **Resuming isn't a state.** It is a way back in at whatever stage the work is in, so it is a sentence under the diagram rather than a node with arrows to every other node.
