# Security and isolation

Autonomous coding agents execute commands with your local user's permissions. More
autonomy and more parallel agents mean more commands running without a human reading each
one first. Treat the harness as a system that runs untrusted-ish code on your behalf, and
design for **least privilege**.

## Assume least privilege

Give agents the minimum they need:

- **Scope credentials.** An agent should hold the narrowest token that lets it do its
  job. Do not hand a coding agent a broadly-scoped cloud key "just in case."
- **Separate identities from your own.** This machine has GitHub CLI authenticated as
  `mpaiva` (scopes: `repo`, `read:org`, `workflow`, `gist`) with a secondary
  `mpaiva-cc` account. Prefer a dedicated, minimally-scoped identity for autonomous PR
  work over your primary human identity.
- **No standing production access.** See below.

## Prefer isolated environments

Run highly autonomous workflows in an environment that is **not** your primary machine
with all your keys:

```text
devcontainer · VM · remote development box · ephemeral machine
```

Herdr supports this directly — it can hold the runtime on "a box you rent" and you attach
over SSH:

```bash
herdr --remote <ssh-target> --session <name>
```

That keeps the agents' blast radius on a disposable host while you supervise from your
laptop.

## Avoid running autonomous swarms on machines with

- production access
- sensitive company credentials
- unrelated customer data
- broad cloud permissions

If your dev machine has any of these, move the autonomous work to an isolated environment
before you scale up agent count.

## Installer and supply-chain hygiene

- The Herdr installer is fetched and executed as a remote script:
  `curl -fsSL https://herdr.dev/install.sh | sh`. This runs unreviewed code. For a
  trusted setup, **download the script, read it, then run it**, or pin to a released
  binary.
- Atomic is installed from npm (`@bastani/atomic`); pin versions in team setups.
- Agents can install extensions/integrations (`atomic install …`,
  `herdr integration install …`). Treat each as a dependency you vetted, not a
  free-for-all.

## Secrets never enter the repo

This repo's `.gitignore` excludes `.env*`, keys, `.atomic/`, `.herdr/`, and local config.
Do not commit:

- API keys, tokens, provider credentials
- `~/.config/herdr/config.toml` or `~/.atomic/` contents
- anything an agent printed that contains a secret

If an agent needs a credential, provide it via environment or the tool's own auth flow
(Atomic can print scoped credentials for external clients via `atomic auth …`), not by
writing it into a tracked file.

## Security as a review gate

Security is one of the **human review gates** in the workflow (see
[verification-and-gates.md](verification-and-gates.md)). Any change that touches identity,
permissions, sensitive data, or external systems stops for human judgment before it can
merge — automated checks do not clear it on their own.

## Checklist before scaling autonomy

- [ ] Agents run in an isolated environment (devcontainer / VM / remote box), not on a
      machine with production access.
- [ ] Credentials are scoped to the minimum; no primary-identity broad tokens.
- [ ] Installers were reviewed or pinned; extensions/integrations are vetted.
- [ ] `.gitignore` is in force; no secrets in tracked files.
- [ ] A security review gate exists for identity/permissions/data/external-system changes.
- [ ] Observability and verification scale **with** the number of agents, not behind it.
