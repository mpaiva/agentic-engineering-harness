# Workflow runs — registry for the `workflows` Herdr tab

One line per named workflow run launched by any teammate. Append, never edit past entries.
`scripts/workflow-tab.sh` reads this file and queries each run-id's live status headlessly
(`/workflow status <run-id>` — confirmed to work cross-process against Atomic's shared
durable backend, unlike `/workflow connect`; see specs/2026-08-16-graph-tab.md).

Format (pipe-separated, one per line, no header row below this point):
`<run-id>|<workflow-name>|<launched-by>|<launched-at ISO8601>`

679f494d-e3b0-4650-b794-1f632d9fb12f|classify-and-act|lead|2026-08-16T06:41:06Z
449ebe1e-ae8d-4853-8840-5658b21600f2|goal|researcher (scratch, G3 evidence)|2026-08-16T08:00:00Z
28cf824a-214a-49f2-acb4-603ae84cd576|goal|researcher (scratch, G2 evidence)|2026-08-16T08:20:00Z
