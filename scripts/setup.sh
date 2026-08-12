#!/usr/bin/env bash
# setup.sh — get a freshly-cloned machine ready to run the harness and the agent team.
# Idempotent: installs what's missing, reports what needs your hands, changes nothing it
# doesn't have to. macOS is the primary target; Linux works for atomic + herdr (skip Ghostty).
#
#   ./scripts/setup.sh
set -uo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/bin:$PATH"
ok(){ printf '  \033[32m✓\033[0m %s\n' "$1"; }
no(){ printf '  \033[31m✗\033[0m %s\n' "$1"; }
info(){ printf '  \033[34m›\033[0m %s\n' "$1"; }
have(){ command -v "$1" >/dev/null 2>&1; }
UNAME="$(uname -s)"

echo "── Agentic Engineering Harness — setup ──"

# 1) Node (Atomic needs >= 22.19)
if have node; then ok "node $(node -v)"; else no "node missing — install Node 22.19+ (https://nodejs.org), then re-run"; fi

# 2) Atomic
if have atomic; then ok "atomic $(atomic --version 2>/dev/null | head -1)"
elif have npm; then info "installing Atomic (npm i -g @bastani/atomic)…"; npm install -g @bastani/atomic >/dev/null 2>&1 \
     && ok "atomic installed" || no "atomic install failed — run: npm install -g @bastani/atomic"
else no "npm missing — install Node first"; fi

# 3) Herdr  (remote install script — run knowingly)
if have herdr; then ok "herdr $(herdr --version 2>/dev/null)"
else
  info "installing Herdr (curl -fsSL https://herdr.dev/install.sh | sh)…"
  curl -fsSL https://herdr.dev/install.sh | sh >/dev/null 2>&1 \
    && ok "herdr installed to ~/.local/bin" || no "herdr install failed — see https://herdr.dev"
  case ":$PATH:" in *":$HOME/.local/bin:"*) : ;; *) info "add ~/.local/bin to your PATH (e.g. in ~/.zshrc)";; esac
fi

# 4) Ghostty (macOS only, via Homebrew)
if [ "$UNAME" = "Darwin" ]; then
  if [ -d /Applications/Ghostty.app ]; then ok "Ghostty installed"
  elif have brew; then info "installing Ghostty (brew install --cask ghostty)…"; brew install --cask ghostty >/dev/null 2>&1 \
       && ok "Ghostty installed" || no "Ghostty install failed — run: brew install --cask ghostty"
  else no "Homebrew missing — install Ghostty from https://ghostty.org"; fi
  if [ -f ghostty/config ] && [ ! -f "$HOME/.config/ghostty/config" ]; then
    mkdir -p "$HOME/.config/ghostty" && cp ghostty/config "$HOME/.config/ghostty/config" && ok "Ghostty config installed"
  fi
else info "non-macOS — skip Ghostty (any terminal works; Herdr runs inside it)"; fi

# 5) Claude Code (the agent backend) — we don't install it, we point you at it
if have claude; then ok "claude $(claude --version 2>/dev/null | head -1)"
else no "claude (Claude Code) missing — install it, then run 'claude' once to log in"; fi

# 6) Herdr ↔ Claude state integration + make the repo's workflows discoverable
if have herdr; then herdr integration install claude >/dev/null 2>&1 && ok "herdr → claude state integration installed" || info "could not install herdr claude integration (run: herdr integration install claude)"; fi
if [ -x scripts/sync-workflows.sh ]; then ./scripts/sync-workflows.sh >/dev/null 2>&1 && ok "workflows synced into .atomic/workflows/" || true; fi

cat <<EOF

── Two things only you can do (credentials — I never touch them) ──
  1. Claude Code:  run  \033[1mclaude\033[0m  once and log in.
  2. Atomic:       run  \033[1matomic\033[0m  →  \033[1m/login\033[0m  →  Claude Pro/Max.

── Then get the agent team going ──
  cd examples/agentic-hris
  ./launch.sh            # dry run — see the plan, touch nothing
  ./launch.sh --layout   # build the split-pane Herdr grid (no paid agents)
  ./launch.sh --go       # FULL LAUNCH — 8 live agents, autonomous
  herdr --session agentic-hris    # attach and watch the control room

See examples/agentic-hris/README.md before --go (cost, autonomy, isolation).
EOF
