# Sandbox secrets

How to give a Docker Sandbox (`sbx`) a credential for a service without the credential ever entering the sandbox.

## Why the proxy

A token never goes inside the sandbox. Agents there run commands and read untrusted content, so a token in an environment variable, a file, or a command line could leak. `sbx` keeps the real value on the host, and its proxy adds it to outgoing requests.

Run the commands below **on the host**. `<sandbox-name>` is the sandbox's name, available inside it as `$SANDBOX_NAME`; drop `--sandbox` to cover every sandbox. The options are in Docker's [credentials documentation](https://docs.docker.com/ai/sandboxes/configuration/credentials/).

## A built-in service

GitHub, and other services `sbx` knows (`sbx secret set --help` lists them), use `sbx secret set` and need nothing in the code:

```bash
sbx secret set github --sandbox <sandbox-name> -t "$(gh auth token)"
```

Inside the sandbox, `gh auth status` reports "not logged in" even when this works; git and `gh` requests are authenticated by the proxy.

## Any other service: a custom secret

Any other service needs a [custom secret](https://docs.docker.com/reference/cli/sbx/secret/set-custom/), which `sbx` marks experimental:

```bash
sbx secret set-custom --sandbox <sandbox-name> --host <api.example.com> --env <VARIABLE_NAME> \
  --command '<absolute path to a helper that prints the token>'
```

- **The sandbox sees a placeholder,** not the token: `<VARIABLE_NAME>` holds the value `set-custom` prints.
- **The code must send it in a request header** (for example, `Authorization: Bearer $<VARIABLE_NAME>`) to the `--host` given. The proxy swaps the placeholder for the real token only there; any other host receives the placeholder unchanged.
- **Only new processes see the variable.** A running agent session won't see it until it restarts.
- **Keep the token out of shell history** with `--command`, or `--ref` for a password-manager reference. `-t` and `--value` also work but leave the token in history.
- **Pitfall:** `sbx secret set <name>` with a name that isn't a built-in service stores the secret and lists it, but never injects it.

## Secrets this repository uses

| Service | Kind | Details |
| :--- | :--- | :--- |
| GitHub | built-in | git push and `gh` through the proxy |

`NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY` is not a secret: it is exposed to every browser that loads the app ([README](../../README.md#optional-liveblocks-sync)). A Liveblocks secret key, needed for token authentication, would belong on a trusted backend, never in client code; add its row here when it arrives.
