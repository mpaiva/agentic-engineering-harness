#!/usr/bin/env bash
# launch-atomic.sh — stand up the same nine-role team as launch.sh, but with **Atomic**
# sessions instead of Claude Code, coordinating over **Atomic Intercom** instead of
# `herdr agent prompt`, with live state pushed into the Herdr sidebar by the
# `atomic/extensions/herdr-state.ts` adapter.
#
#   ./launch-atomic.sh                 # DRY RUN — print the plan + every prompt, touch nothing
#   ./launch-atomic.sh --layout        # build the split-pane Herdr grid only (no paid agents)
#   ./launch-atomic.sh --go            # FULL LAUNCH — nine live Atomic agents, autonomous
#   ./launch-atomic.sh --go --model claude-opus-5
#
# WHY THIS EXISTS ALONGSIDE launch.sh
#
# launch.sh uses Claude Code, which Herdr detects natively (`herdr agent start --kind claude`),
# so agents coordinate with `herdr agent prompt` and Herdr fills in the sidebar itself.
# Atomic is NOT one of Herdr 0.8.0's ~21 known agent kinds, so none of that applies here:
#
#   - Coordination is **Atomic Intercom** — a first-party broker for direct messaging between
#     Atomic sessions on the same machine. (Not workflow-scoped: see docs/intercom.md.)
#   - Sidebar state comes from **atomic/extensions/herdr-state.ts**, which pushes
#     `pane.report_agent` over Herdr's socket API on Atomic's lifecycle events.
#   - Panes are named by role with `herdr pane rename`, since `herdr agent start` is unavailable.
#
# Team & layout (right + down splits) — a 3×3 grid, same as launch.sh:
#     ┌───────────────┬───────────────┬───────────────┐
#     │  lead         │ pm            │ researcher    │
#     ├───────────────┼───────────────┼───────────────┤
#     │  designer     │ frontend      │ ax            │
#     ├───────────────┼───────────────┼───────────────┤
#     │  accessibility│ backend       │ verifier      │
#     └───────────────┴───────────────┴───────────────┘
#
# GUARDRAILS: agents work only in ./build/ (isolated). Nine live Atomic sessions spend real
# tokens continuously. Uses its own Herdr session so it never disturbs launch.sh's.
#
# Verified against Atomic 0.9.12 and Herdr 0.8.0. Bash 3.2 safe.
set -euo pipefail

SESSION="agentic-hris-atomic"
GROUP="agentic-hris"
PROVIDER="anthropic"
MODEL="claude-sonnet-5"
MODE="dry-run"
while [ $# -gt 0 ]; do
  case "$1" in
    --go) MODE="go" ;;
    --layout) MODE="layout" ;;
    --session) SESSION="$2"; shift ;;
    --model) MODEL="$2"; shift ;;
    --provider) PROVIDER="$2"; shift ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac; shift
done

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
BUILD="$HERE/build"
LAUNCHDIR="$BUILD/.launch"
EXT="$REPO/atomic/extensions/herdr-state.ts"
export PATH="$HOME/.local/bin:$PATH"
herdr(){ command herdr --session "$SESSION" "$@"; }
pane_id(){ python3 -c "import sys,json;print(json.load(sys.stdin)['result']['pane']['pane_id'])"; }

ROLES="lead pm researcher designer frontend ax backend accessibility verifier"
SPECIALISTS="pm researcher designer frontend ax backend accessibility verifier"

# ── The transport brief: appended to EVERY agent's system prompt ──────────────────
# This deliberately overrides the `herdr agent prompt` lines in team/lead.md, which are
# correct for launch.sh (Claude Code) and wrong here.
transport_brief(){
  cat <<EOF
--- HOW THIS TEAM COMMUNICATES (this OVERRIDES any \`herdr agent prompt\` instructions in your role brief) ---

You are one of nine Atomic sessions running side by side in a Herdr cockpit. You talk to your
teammates with Atomic's **intercom** tool. Do NOT use \`herdr agent prompt\` — it cannot reach
these agents. Your teammates, addressable by exactly these names:

  lead  pm  researcher  designer  frontend  ax  backend  accessibility  verifier

  Delegate / notify / hand off :  intercom({ action: "send",  to: "<name>", message: "..." })
  Ask a BLOCKING question      :  intercom({ action: "ask",   to: "<name>", message: "..." })
  Answer a question sent to you:  intercom({ action: "reply", message: "..." })
  See who is live              :  intercom({ action: "list" })

RULES THAT KEEP THIS TEAM FROM DEADLOCKING — follow them exactly:

1. The **lead delegates with \`send\`, never \`ask\`.** Only one \`ask\` may be outstanding per
   session; a lead blocked inside an \`ask\` cannot be reached by the other eight agents.
2. Use \`ask\` only when you genuinely cannot proceed without the answer. Otherwise \`send\`.
3. If a message arrives asking you something, **\`reply\` promptly** — a teammate is blocked
   waiting on you. Answer decisively; do not start a long task before replying.
4. A session appears in \`list\` only after it has used intercom at least once, so an empty
   roster means your teammates are still booting — not that you are working alone.
5. When you finish a task, \`send\` the result to whoever asked for it. Artifacts are files
   under $BUILD — reference them by path rather than pasting them.

NEVER TERMINATE YOUR OWN PANE OR SESSION. Do not run \`exit\`, \`herdr pane close\`,
\`herdr server stop\`, or anything else that closes a pane or stops the Herdr session — not on
yourself and not on a teammate. A closed pane takes its scrollback with it, so the human loses
the record of what you did, and the team loses an agent it cannot get back. \`herdr\` commands
cannot reach these agents anyway (that is what intercom is for), so you have no reason to run
one. If you believe your work is finished, say so and stop generating; the human decides when
this team shuts down.

Your working directory is $BUILD. Never touch anything outside it.
EOF
}

lead_kickoff_brief(){
  cat <<EOF
--- YOU ARE THE LEAD ---

You are the principal engineer and orchestrator. Mission & definition of done: $HERE/MISSION.md
(read it fully before acting). Build directory (isolated): $BUILD

"pm" is your peer: pm owns WHAT/WHY (priorities, scope, product acceptance), you own HOW.

Drive the build:
 1. Read the mission.
 2. In parallel, \`send\` "pm" the task of writing $BUILD/PRD.md (v1 scope, non-goals,
    acceptance criteria) and "researcher" the task of gathering evidence into $BUILD/RESEARCH.md.
 3. With the PRD + research, have "designer" write $BUILD/DESIGN.md and "accessibility" write
    $BUILD/A11Y.md, while "backend" ships the data model + tools + seed.
 4. Write $BUILD/CONTRACT.md fixing the data model, API surface, and copilot tool contract.
 5. Then have "frontend" and "ax" build to the specs.
 6. After each slice, task "verifier" to re-run checks and report evidence, and "pm" to accept
    it against the PRD — do not call it done without both.

Route product/scope questions to "pm" and "how does X work" questions to "researcher".
Drive to the MISSION.md acceptance criteria, write $BUILD/EVIDENCE.md, then stop. Max ~3 repair
cycles per slice, else write $BUILD/BLOCKED.md and stop for the human.
EOF
}

# ── DRY RUN: print the plan and the exact prompts, touch nothing ─────────────────
if [ "$MODE" = "dry-run" ]; then
  echo "════════════════════════════════════════════════════════════════════"
  echo " DRY RUN — nothing launched. Atomic + Intercom variant."
  echo " Session: $SESSION   ·   Intercom group: $GROUP"
  echo " Model:   $PROVIDER/$MODEL"
  echo " Adapter: $EXT"
  echo " Build:   $BUILD"
  echo "════════════════════════════════════════════════════════════════════"
  echo "Team: $ROLES"
  echo; echo "── transport brief (appended to every agent's system prompt) ──"
  transport_brief | sed 's/^/  /'
  echo; echo "── lead kickoff brief ──"; lead_kickoff_brief | sed 's/^/  /'
  echo; echo "Each agent also gets its full role brief from team/<role>.md."
  echo; echo "To build just the Herdr grid:   ./launch-atomic.sh --layout"
  echo "To launch for real (paid, autonomous):   ./launch-atomic.sh --go"
  exit 0
fi

# ── Preconditions ────────────────────────────────────────────────────────────────
command -v herdr >/dev/null || { echo "herdr not found on PATH (run ../../scripts/setup.sh)" >&2; exit 1; }
if [ "$MODE" = "go" ]; then
  command -v atomic >/dev/null || { echo "atomic not found on PATH (npm i -g @bastani/atomic)" >&2; exit 1; }
  [ -f "$EXT" ] || { echo "adapter not found: $EXT" >&2; exit 1; }
  # Fail fast on auth rather than booting nine sessions that cannot reach a model.
  if ! atomic auth print-bearer-token --model "$MODEL" --provider "$PROVIDER" >/dev/null 2>&1; then
    echo "atomic has no usable credential for $PROVIDER/$MODEL — run 'atomic' and '/login'." >&2
    exit 1
  fi
fi
mkdir -p "$BUILD" "$LAUNCHDIR"

# ── Write the per-role launcher scripts ──────────────────────────────────────────
# One script per role, so the pane only ever receives a SINGLE LINE of text. Pasting a
# multi-line brief into a TUI would submit at the first newline; the briefs travel as
# --append-system-prompt arguments instead.
transport_brief > "$LAUNCHDIR/TRANSPORT.md"
lead_kickoff_brief > "$LAUNCHDIR/LEAD.md"

for r in $ROLES; do
  {
    echo '#!/usr/bin/env bash'
    echo "# generated by launch-atomic.sh — starts the '$r' agent"
    echo "export ATOMIC_ROLE=$r"
    echo "export ATOMIC_INTERCOM_GROUP=$GROUP"
    echo "cd \"$HERE\""
    # Deliberately NOT `exec`: keep a shell wrapping Atomic so that when a session ends, the
    # exit status lands in the pane's scrollback instead of vanishing. stderr is teed to a log
    # as well, because a pane that dies takes its scrollback with it — and a crash you cannot
    # read is a crash you cannot fix.
    printf 'atomic -e %q --provider %q --model %q -n %q \\\n' "$EXT" "$PROVIDER" "$MODEL" "$r"
    printf '  --append-system-prompt "$(cat %q)" \\\n' "$HERE/team/$r.md"
    printf '  --append-system-prompt "$(cat %q)"' "$LAUNCHDIR/TRANSPORT.md"
    if [ "$r" = "lead" ]; then
      printf ' \\\n  --append-system-prompt "$(cat %q)"' "$LAUNCHDIR/LEAD.md"
    fi
    printf ' \\\n  2> >(tee -a %q >&2)\n' "$LAUNCHDIR/$r.stderr.log"
    echo 'status=$?'
    echo "echo"
    echo "echo \"[herdr] the '$r' Atomic session exited (status \$status). Pane kept open —\""
    echo "echo \"[herdr] scrollback above, stderr in $LAUNCHDIR/$r.stderr.log\""
    echo "echo \"[herdr] restart with: bash $LAUNCHDIR/$r.sh\""
  } > "$LAUNCHDIR/$r.sh"
  chmod +x "$LAUNCHDIR/$r.sh"
done

# ── Fresh session, started FROM the HRIS dir so every pane inherits that cwd ──────
herdr server stop >/dev/null 2>&1 || true
sleep 1
rm -rf "$HOME/.config/herdr/sessions/$SESSION"
sleep 0.5
( cd "$HERE" && command herdr server --session "$SESSION" >/dev/null 2>&1 & )
for _ in $(seq 1 40); do
  if herdr workspace list 2>/dev/null | grep -q '"workspaces"'; then break; fi
  sleep 0.3
done
herdr workspace create --label "Agentic HRIS (Atomic)" >/dev/null 2>&1 || true

# The root shell pane is NOT reliably panes[0]: Herdr's sidebar plugin also owns a pane and
# may register first. Plugin panes always carry a label ("Sidebar", "Explorer", … depending on
# which plugins are installed), while the root shell pane has none — so select on the absence
# of a label rather than on any particular plugin name, and take the lowest-numbered match.
root_pane(){
  herdr pane list 2>/dev/null | python3 -c "
import sys,json
try: panes=json.load(sys.stdin)['result']['panes']
except Exception: sys.exit(1)
shells=[p for p in panes if not p.get('label')]
if not shells: sys.exit(1)
print(sorted(shells,key=lambda p:p['pane_id'])[0]['pane_id'])
"
}
LEAD=""
for _ in $(seq 1 40); do
  LEAD="$(root_pane || true)"
  [ -n "$LEAD" ] && break
  sleep 0.5
done
[ -n "$LEAD" ] || { echo "could not find a shell pane to build the grid in" >&2; exit 1; }

# ── Build the split grid (right + down): a 3×3 ───────────────────────────────────
PM=$(herdr pane split "$LEAD"            --direction right --no-focus --cwd "$HERE" | pane_id)
RESEARCHER=$(herdr pane split "$PM"      --direction right --no-focus --cwd "$HERE" | pane_id)
DESIGNER=$(herdr pane split "$LEAD"      --direction down  --no-focus --cwd "$HERE" | pane_id)
FRONTEND=$(herdr pane split "$PM"        --direction down  --no-focus --cwd "$HERE" | pane_id)
AX=$(herdr pane split "$RESEARCHER"      --direction down  --no-focus --cwd "$HERE" | pane_id)
ACCESSIBILITY=$(herdr pane split "$DESIGNER" --direction down --no-focus --cwd "$HERE" | pane_id)
BACKEND=$(herdr pane split "$FRONTEND"   --direction down  --no-focus --cwd "$HERE" | pane_id)
VERIFIER=$(herdr pane split "$AX"        --direction down  --no-focus --cwd "$HERE" | pane_id)

pane_for(){ # $1 = role
  case "$1" in
    lead) echo "$LEAD" ;;            pm) echo "$PM" ;;
    researcher) echo "$RESEARCHER" ;; designer) echo "$DESIGNER" ;;
    frontend) echo "$FRONTEND" ;;     ax) echo "$AX" ;;
    backend) echo "$BACKEND" ;;       accessibility) echo "$ACCESSIBILITY" ;;
    verifier) echo "$VERIFIER" ;;
  esac
}

# Name the panes by role. With no `herdr agent start`, this label is what identifies a pane
# in the cockpit — and it is what the human reads when scanning the grid.
for r in $ROLES; do herdr pane rename "$(pane_for "$r")" "$r" >/dev/null 2>&1 || true; done
echo "grid: lead=$LEAD pm=$PM researcher=$RESEARCHER designer=$DESIGNER frontend=$FRONTEND ax=$AX backend=$BACKEND accessibility=$ACCESSIBILITY verifier=$VERIFIER"

if [ "$MODE" = "layout" ]; then
  echo "✓ Herdr grid built and named (no agents started). Attach to watch:  herdr --session $SESSION"
  echo "  Tear down:  herdr --session $SESSION server stop"
  exit 0
fi

# ── GO: start an Atomic session in each pane, name it, then brief it ─────────────
send_line(){ # $1 pane  $2 text — one line, then Enter
  herdr pane send-text "$1" "$2" >/dev/null 2>&1 || return 1
  herdr pane send-keys "$1" Enter >/dev/null 2>&1 || return 1
}

wait_for_atomic(){ # $1 pane — poll until the pane's title shows Atomic is up
  for _ in $(seq 1 60); do
    if herdr pane list 2>/dev/null | python3 -c "
import sys,json
p=[x for x in json.load(sys.stdin)['result']['panes'] if x['pane_id']=='$1']
sys.exit(0 if p and (p[0].get('terminal_title_stripped') or '').startswith('atomic') else 1)
" 2>/dev/null; then return 0; fi
    sleep 1
  done
  return 1
}

start_agent(){ # $1 role
  role="$1"; pane="$(pane_for "$role")"
  send_line "$pane" "bash $LAUNCHDIR/$role.sh" || { echo "  ! could not start '$role'" >&2; return 0; }
  wait_for_atomic "$pane" || { echo "  ! '$role' did not reach the Atomic prompt" >&2; return 0; }
  # ORDER MATTERS: /name must land BEFORE the session's first intercom call. A session that
  # connects to the broker unnamed registers a `subagent-chat-<id>` alias and stays
  # unaddressable by role for the rest of its life.
  send_line "$pane" "/name $role"
  sleep 2
  echo "  ✓ $role started + named"
}

echo "Starting nine Atomic sessions (this takes a moment each)…"
for r in $ROLES; do start_agent "$r"; done

# ── Brief them: specialists register with the broker first, then the lead delegates ──
# Each kickoff is ONE line — it is typed into a TUI, and a newline would submit early.
echo "Briefing the specialists…"
for r in $SPECIALISTS; do
  send_line "$(pane_for "$r")" "You are the \"$r\" agent on this team. Read $HERE/MISSION.md now, plus your role brief. Then your FIRST action must be: intercom send to \"lead\" with the message \"$r ready\" — this registers you with the broker so the lead can find you. After that, stop and wait; the lead will assign you work, and incoming messages will wake you."
  sleep 1
done
sleep 3
echo "Starting the lead (it will read the mission and delegate)…"
send_line "$(pane_for lead)" "Begin. Read $HERE/MISSION.md in full, run intercom list to see which teammates have registered, then start delegating per your kickoff brief — delegate with intercom send, never ask."

cat <<EOF

════════════════════════════════════════════════════════════════════
 The team is live: nine Atomic sessions coordinating over Intercom.
════════════════════════════════════════════════════════════════════
 WATCH:    herdr --session $SESSION      (attach the cockpit; panes are named by role,
           and the sidebar state comes from the herdr-state adapter)
 PEEK:     herdr --session $SESSION pane read <role-pane-id>
 ROSTER:   ask any agent to run intercom list — it shows every registered session
 PAUSE:    herdr --session $SESSION pane send-keys <pane> esc     (Atomic cancels its turn)
 STOP 1:   type /exit in a pane                                   (clean Atomic shutdown)
 STOP ALL: herdr --session $SESSION server stop                   (halt the whole team)

 Output lands in:  $BUILD   (isolated — nothing else in the repo is touched)
 Model: $PROVIDER/$MODEL across nine sessions. This spends real tokens continuously.
        Check in, and stop them when you've seen enough.
EOF
