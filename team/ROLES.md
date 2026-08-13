# The role library

The lead reads this to compose a team for **this** mission. Hire the roles the mission needs
and no others: an idle agent costs money and adds coordination overhead. Team cap: 8.

Every role is domain-neutral. The mission supplies the domain; the brief supplies the
discipline.

| Role | Owns | Hire when |
|---|---|---|
| `pm` | Scope, priorities, product acceptance | The mission has real product judgment in it — competing features, unclear priorities, a "what does done mean" question you should not answer alone. Skip for a small, fully-specified utility. |
| `researcher` | Decision-ready evidence: prior art, libraries, formats, standards | The mission depends on facts you do not have — an unfamiliar library, a spec, a format, a platform constraint. Skip when the stack is obvious and the domain is familiar. |
| `architect` | Interfaces, data model, module boundaries | More than two components must agree on a shape, or the design has a hard-to-reverse decision in it. Skip for a single-module program. |
| `implementer` | Writing the actual code | Always, for anything that ships code. Hire a second one **only** when two work streams are genuinely independent — the contract is fixed and they touch different files. |
| `designer` | User-facing interaction and information design | The mission has a human-facing surface: a UI, a CLI's ergonomics, an output format people read. Skip for a library or an internal API. |
| `accessibility` | WCAG conformance, keyboard and assistive-tech behavior | The mission builds a graphical user interface. **Never hire for a CLI, a library, or a service** — there is no interface to make accessible. |
| `verifier` | Independent, fresh-context proof that the criteria are met | **Always.** This is the floor of trust: the agent that wrote the code is not the one who decides it is correct. |
| `devops` | Build, packaging, CI, release, runtime environment | The mission says how it must be built, packaged, deployed, or run in CI. Skip when running it locally is the whole story. |
| `docs` | README, usage docs, examples for the built product | The mission's audience is other people who must operate what you built. Skip when the success criteria never mention documentation. |

## Composition examples

- **A CLI that converts CSV to JSON** → `implementer`, `verifier`, and `docs` if usage
  documentation is a success criterion. Three agents. No designer, no accessibility, no pm.
- **A web app with a database** → `pm`, `researcher`, `architect`, `implementer` ×2,
  `designer`, `accessibility`, `verifier`. Eight agents.
- **A library with an unfamiliar spec** → `researcher`, `architect`, `implementer`,
  `verifier`. Four agents.

If you find yourself hiring every role, re-read the mission — you are probably building
something smaller than the roster implies.
