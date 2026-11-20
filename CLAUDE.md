# Claude Code entry point

Claude Code reads `AGENTS.md` on its own only when no `CLAUDE.md` exists in the working directory or a folder above it, and some sessions can't read `AGENTS.md` at all. Importing it here loads the repository's agent guidelines in every Claude Code session; other agents read `AGENTS.md` directly. See Claude Code's [memory documentation](https://code.claude.com/docs/en/memory).

@AGENTS.md
