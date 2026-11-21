# Revising work

When the owner gives feedback on submitted work, record it on the pull request, act on it, and record the response there too. Feedback can come as a GitHub review or in a session's conversation. Either way the pull request is the record: a session's context doesn't outlast it, and [resuming work](resuming-work.md) reads the pull request, not an earlier conversation.

## Steps

Replace `<n>` with the pull request number.

1. **Reopen.** Put the pull request back to draft, as [Draft until done](submitting-work.md#draft-until-done) says.

2. **Record feedback given in the session before acting on it.** Post it as a pull request comment, quoting the owner's words, so it survives if the session ends partway through the change. Feedback given as a GitHub review is already recorded; skip this step for it.

   ```bash
   gh pr comment <n> --body-file <file>
   ```

   Start the comment with where the feedback came from and its date, for example "Feedback given in a Claude Code session, 2026-11-21:", and quote it. One comment per request, so each response can point to it.

3. **Make the change,** then reply to say what changed and in which commits. Reply to an inline review comment in its thread. A pull request comment has no thread, so post a new comment that links to the one it answers. Where the owner was given options, say which was taken. Where the feedback was declined or changed, say why.

4. **Keep the description current.** Update "Decisions made" and the other sections in [What the description carries](submitting-work.md#what-the-description-carries) so they describe the pull request as it is now. The comments hold the history; don't copy it into the description.

5. **Record decisions a later session could undo** in the changed document's sidecar, as [Reasons live in a `.meta.md` sidecar](../../prose/single-source-of-truth.md#reasons-live-in-a-metamd-sidecar) says.

6. **Submit it again.** Run the [definition-of-done checks](../../../AGENTS.md#definition-of-done), push, and mark it ready as [Draft until done](submitting-work.md#draft-until-done) says.

## Changing this document

The reasons for these rules and the decisions behind them are in [revising-work.meta.md](revising-work.meta.md). Read it only when changing or questioning a rule here.
