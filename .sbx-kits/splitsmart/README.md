# SplitSmart Docker Sandbox kit

This local [Docker Sandboxes](https://docs.docker.com/ai/sandboxes/) mixin provisions Node.js 26 and installs the dependencies in `package-lock.json`. It follows [market-research's sandbox setup](https://github.com/DetweilerRyan/market-research/tree/main/.sbx-kits/market-research), but uses a v3 kit: current built-in `sbx` agents use v3 and cannot load v2 mixins.

## Start and verify

Install Docker Sandboxes with v3 kit support (`sbx` 0.45 or newer), Docker Buildx, and an agent supported by `sbx`. Sign in with `sbx login` if required. From the host's main repository checkout:

```sh
sbx kit validate ./.sbx-kits/splitsmart
sbx run --clone --name splitsmart claude --kit ./.sbx-kits/splitsmart .
```

Replace `claude` with another supported v3 agent. Kit selection and `--clone` apply when the sandbox is created; use a different name to try a changed kit or a separate sandbox. The local kit is built at creation; it does not need to be published.

Startup runs alongside the agent. Inside the sandbox, wait until `~/.cache/splitsmart-kit.log` says `SplitSmart setup complete` before using the dependencies. Inspect the log for errors; retry from the repository root with `sh scripts/prepare-sandbox.sh`. The script serializes its own installs and skips `npm ci` when the manifests, Node and npm versions have not changed. If `node_modules` needs repair, remove its `.splitsmart-install` marker and rerun the script. Do not run other package installations concurrently.

```sh
cat ~/.cache/splitsmart-kit.log
npm test
npm run build
npm run dev -- --hostname 0.0.0.0
```

To reach the development server from the host, run `sbx port publish splitsmart 3000` on the host and use the loopback address shown by `sbx port ls splitsmart`. Published ports can be accessed by other local processes. Stop forwarding with `sbx port unpublish`; see Docker's [port instructions](https://docs.docker.com/ai/sandboxes/workflows/development/#accessing-services-in-the-sandbox).

## Clone mode and VS Code

The sandbox works in a separate clone; the host checkout is read-only at `/run/sandbox/source`. Host edits do not appear in the clone until committed and fetched. Push a branch from the sandbox, or while it is running fetch it on the host with `git fetch sandbox-splitsmart`. **Removing the sandbox deletes the clone, including unpushed commits and untracked files**; push or fetch the work first. Start from the main checkout, not a linked host worktree. See [Docker's Git workflow](https://docs.docker.com/ai/sandboxes/workflows/git/#clone-mode).

For VS Code, install the Remote - SSH and Dev Containers extensions. On the host run `sbx setup ssh`, connect to `splitsmart.sbx` with Remote - SSH, open the repository path inside the sandbox, and choose **Dev Containers: Reopen in Container**. Wait for sandbox setup to finish before opening the container. Its post-create command checks the same lockfile and provisions dependencies if needed.

The dev container uses the sandbox's Docker daemon and mounts the workspace at its existing path. It also mounts `/run/sandbox/source` read-only at the same path so Git can resolve clone-mode object alternates without rewriting them or racing Git operations. This configuration is intended for a clone-mode sandbox, not direct use on the host; the source mount must exist in the sandbox. The container can read the host source through this mount, just as the sandbox can. If Docker cannot pull the Node image, check the sandbox's network policy and approve the required registry access.

## Network and credentials

The kit requests runtime access to `registry.npmjs.org` for the lockfile and `github.com` and `api.github.com` for Git and the GitHub CLI. Agent kits and host policies may add or restrict access. Check redirect destinations and request narrowly scoped host approvals when needed; do not broaden the policy just to suppress an error. Application features may require additional network access, for example WebRTC signaling or the optional exchange-rate service.

Keep tokens on the host. Use Docker Sandboxes' [credential and secret proxy](https://docs.docker.com/ai/sandboxes/configuration/credentials/) and approve the appropriate binding rather than putting secrets in the repository, container environment, or command history. The optional `NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY` is client-exposed and is not a secret.
