#!/usr/bin/env bash
# team-status.sh — a live roster + state board for the team, shown in the 'team' tab.
#
#   ./scripts/team-status.sh                 # live view in this pane
#   HERDR_SESSION=harness ./scripts/team-status.sh
#
# It joins three things the harness already produces: `herdr agent list` (each agent's live
# state — working/blocked/idle/done), team/ROLES.md (what each role owns + when to hire it),
# and build/BOARD/*.md (each member's current card). It shows hired crew first, then the roles
# still available to hire. BLOCKED / UNKNOWN sort last so they are the final thing you read.
#
# It is a viewer, not a controller — hiring stays an explicit act. The footer prints the exact
# scripts/team.sh commands to add a role, list roles, or see the roster. Refreshes every 2s and
# on resize; q quits. Piped / non-interactive output renders once and exits.
#
# Dependency-free beyond what the rest of the harness already needs (bash, python3 for the one
# JSON parse — same as scripts/status.sh). Bash 3.2 safe. Verified against Herdr 0.8.0.
set -uo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="${BUILD_DIR:-$HERE/build}"
SESSION="${HERDR_SESSION:-harness}"
export PATH="$HOME/.local/bin:$PATH"
herdr(){ command herdr --session "$SESSION" "$@"; }

# The rollup reads `herdr agent list` JSON on stdin, plus team/ROLES.md (owns + hire-when,
# ground truth) and build/BOARD/*.md (each owner's current card) via env, then prints two
# sections: hired crew (section 1) and available-not-hired roles (section 2).
ROLLUP=$(cat <<'PY'
import sys, json, os, re, glob
mark  = {"working":"\u25cf","blocked":"!","idle":"\u25cb","unknown":"?","done":"\u2713"}
color = {"working":"38;5;150","blocked":"1;33","idle":"38;5;244","unknown":"1;33","done":"38;5;150"}
order = {"working":0,"idle":1,"done":1,"unknown":2,"blocked":3}
E="\033"; R=E+"[0m"; DIM=E+"[2m"; B=E+"[1m"
pal=["39","213","46","214","123","208","220","141"]      # per-name chip colours (match team-chat.sh)
def chip(name):
    su=sum(ord(c) for c in name)
    return E+"[1;38;5;16;48;5;"+pal[su%len(pal)]+"m "+name+" "+R

HERE  = os.environ.get("HERE","")
BUILD = os.environ.get("BUILD", os.path.join(HERE,"build"))
try:    W=int(os.environ.get("COLUMNS","0")) or 100
except Exception: W=100
W=max(60, min(W,160))

def clip(s, n):
    s=re.sub(r"\*\*","",s).strip()
    if n<4: return ""
    return s if len(s)<=n else s[:n-1].rstrip()+"\u2026"

def first_sentence(s):
    s=re.sub(r"\*\*","",s).strip()
    parts=re.split(r"(?<=[.!?])\s", s)
    return parts[0].strip() if parts else s

# --- role library: owns + hire-when, straight from team/ROLES.md (ground truth) ---
owns={}; hire_when={}; role_order=[]
try:
    for line in open(os.path.join(HERE,"team","ROLES.md")):
        m=re.match(r"\s*\|\s*`([^`]+)`\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*$", line)
        if m:
            r=m.group(1)
            owns[r]=m.group(2); hire_when[r]=m.group(3); role_order.append(r)
except Exception:
    pass

# --- current task per owner, from the kanban cards ---
rank={"working":0,"blocked":1,"waiting":2,"done":3}
def cards_by_owner():
    out={}
    for path in sorted(glob.glob(os.path.join(BUILD,"BOARD","*.md"))):
        meta={}; title=""; seen_sep=False
        try: body=open(path).read().split("\n")
        except Exception: continue
        for ln in body:
            if ln.strip()=="---": seen_sep=True; continue
            if not seen_sep:
                if ":" in ln:
                    k,_,v=ln.partition(":"); meta[k.strip()]=v.strip()
            elif ln.strip() and not title: title=ln.strip()
        o=meta.get("owner","")
        if o: out.setdefault(o,[]).append((meta.get("status",""), title))
    return out
tasks=cards_by_owner()
def current_task(name):
    lst=sorted(tasks.get(name,[]), key=lambda t: rank.get(t[0],9))
    if not lst: return ("", False)
    st,title=lst[0]
    return (title, st=="done")           # done -> nothing active

try:    agents=json.load(sys.stdin)["result"].get("agents",[])
except Exception: agents=[]
hired=set(a.get("agent","") for a in agents if a.get("agent"))

# ================= SECTION 1: hired crew =================
print("  "+B+"ON THE JOB"+R+" "+DIM+"\u2014 hired for this mission"+R)
print("")
if not agents:
    print("  "+DIM+"(no agents yet \u2014 the lead boots first, then hires with scripts/team.sh add)"+R)
else:
    NW=max(len(a.get("agent","")) for a in agents)+2
    for a in sorted(agents, key=lambda a: order.get(a.get("agent_status"),9)):
        st=a.get("agent_status","unknown"); nm=a.get("agent",""); pane=a.get("pane_id","")
        col=color.get(st,"0"); mk=mark.get(st,"?")
        ow=owns.get(nm,"") or ("Mission, delegation, sign-off" if nm=="lead" else "")
        task,is_done=current_task(nm)
        # budget: marker(2) chip(NW) status(9) pane(7) separators -> rest split owns/task
        rest=W-(2+NW+1+9+1+7+6)
        ow_w=max(12,int(rest*0.45)); tk_w=max(12,rest-ow_w)
        owt=clip(first_sentence(ow), ow_w)
        if task and not is_done: tkt=clip(task, tk_w)
        elif task and is_done:   tkt=DIM+clip("(last card done)", tk_w)+R
        else:                    tkt=DIM+clip("(no card)", tk_w)+R
        pad=" "*max(0,NW-len(nm)-2)
        flag=(" "+E+"[1;33m\u25c4"+R) if st in ("blocked","unknown") else ""
        print("  "+E+"["+col+"m"+mk+R+" "+chip(nm)+pad+" "
              +E+"["+col+"m"+("%-8s"%st.upper())+R+" "
              +DIM+("%-6s"%pane)+R+" "
              +owt.ljust(ow_w)+" "+DIM+"\u2502"+R+" "+tkt+flag)

# ================= SECTION 2: available, not hired =================
avail=[r for r in role_order if r not in hired]
print("")
print("  "+B+"AVAILABLE, NOT HIRED"+R+" "+DIM+"\u2014 in the role library, not on this mission"+R)
print("")
if not avail:
    print("  "+DIM+"(every role in team/ROLES.md is already hired)"+R)
else:
    for r in avail:
        print("  "+DIM+"\u25cb"+R+" "+("%-14s"%r)+" "+DIM+"hire when"+R+"  "
              +DIM+clip(first_sentence(hire_when.get(r,"")), W-32)+R)
PY
)

render(){
  printf '\033[1mTEAM\033[0m  \033[2msession %s\033[0m\n\n' "$SESSION"
  herdr agent list 2>/dev/null | HERE="$HERE" BUILD="$BUILD" COLUMNS="${COLUMNS:-$(tput cols 2>/dev/null || echo 100)}" python3 -c "$ROLLUP"
  printf '\n\033[2m\xe2\x94\x80\xe2\x94\x80 controls \xe2\x94\x80\xe2\x94\x80\033[0m\n'
  printf '  \033[1mhire\033[0m   scripts/team.sh add <role>\n'
  printf '         --reason "why this mission needs it"\n'
  printf '  \033[1mroles\033[0m  scripts/team.sh roles      \033[1mlist\033[0m  scripts/team.sh list\n'
  printf '\n\033[2mAttend to ! BLOCKED / ? UNKNOWN. \xe2\x97\x8f WORKING needs nothing from you.\033[0m\n'
}

# Piped / non-interactive: nothing to refresh — render once and exit.
if [ ! -t 1 ] || [ ! -t 0 ]; then
  render
  exit 0
fi

# ---- live view ----
TMP="$(mktemp "${TMPDIR:-/tmp}/teamstatus.XXXXXX")"
cleanup(){ printf '\033[?25h\033[?1049l'; rm -f "$TMP"; }
trap cleanup EXIT
trap 'printf "\033[?25h\033[?1049l"; exit 0' INT TERM
printf '\033[?1049h\033[?25l'                 # alt screen + hide cursor

# Flicker-free: home the cursor, redraw each line with a clear-to-EOL, then clear anything left
# below — no full-screen clear (that flashes on every 2s refresh).
paint(){ render > "$TMP"; printf '\033[H'; sed 's/$/\033[K/' "$TMP"; printf '\033[J'; }

while :; do
  paint
  key=""; IFS= read -rsn1 -t 2 key </dev/tty || true
  case "$key" in q|Q) break ;; esac
done
