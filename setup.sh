#!/usr/bin/env bash
#
# One-shot setup for the portfolio OS.
#
#   ./setup.sh           set everything up
#   ./setup.sh --start   set up, then start the dev server
#   ./setup.sh --help    options
#
# Safe to run more than once — every step checks before it acts.

set -euo pipefail

# Run from the repo root no matter where this was invoked from.
cd "$(dirname "${BASH_SOURCE[0]}")"

MIN_NODE_MAJOR=20
MIN_NODE_MINOR=9   # Next.js 16 requires Node >= 20.9.0

START_AFTER=0
for arg in "$@"; do
  case "$arg" in
    --start) START_AFTER=1 ;;
    -h|--help)
      sed -n '2,10p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown option: $arg (try --help)" >&2
      exit 1
      ;;
  esac
done

# ── pretty output, but only when attached to a terminal ──────────────────────
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'; GREEN=$'\033[32m'
  YELLOW=$'\033[33m'; RESET=$'\033[0m'
else
  BOLD=""; DIM=""; RED=""; GREEN=""; YELLOW=""; RESET=""
fi

step() { printf '\n%s==>%s %s%s\n' "$BOLD" "$RESET" "$1" "$RESET"; }
ok()   { printf '    %s✓%s %s\n' "$GREEN" "$RESET" "$1"; }
warn() { printf '    %s!%s %s\n' "$YELLOW" "$RESET" "$1"; }
die()  { printf '\n%serror:%s %s\n\n' "$RED" "$RESET" "$1" >&2; exit 1; }

printf '%s\n' "${BOLD}Setting up the portfolio OS${RESET}"

# ── 1. Node ──────────────────────────────────────────────────────────────────
step "Checking Node.js"

if ! command -v node >/dev/null 2>&1; then
  die "Node.js isn't installed.

  Install Node ${MIN_NODE_MAJOR}.${MIN_NODE_MINOR}+ (22 LTS recommended), then run this again:

    macOS      brew install node
    Windows    https://nodejs.org  (or use WSL)
    Linux      https://github.com/nvm-sh/nvm  then:  nvm install --lts
    Any OS     https://nodejs.org"
fi

NODE_RAW="$(node --version)"          # e.g. v22.22.2
NODE_VER="${NODE_RAW#v}"
NODE_MAJOR="${NODE_VER%%.*}"
NODE_REST="${NODE_VER#*.}"
NODE_MINOR="${NODE_REST%%.*}"

if [ "$NODE_MAJOR" -lt "$MIN_NODE_MAJOR" ] ||
   { [ "$NODE_MAJOR" -eq "$MIN_NODE_MAJOR" ] && [ "$NODE_MINOR" -lt "$MIN_NODE_MINOR" ]; }; then
  die "Node ${NODE_VER} is too old. This project needs ${MIN_NODE_MAJOR}.${MIN_NODE_MINOR}+ (22 LTS recommended).

  If you use nvm:   nvm install --lts && nvm use --lts"
fi
ok "Node ${NODE_VER}"

command -v npm >/dev/null 2>&1 || die "npm isn't on your PATH. It normally ships with Node — try reinstalling Node."
ok "npm $(npm --version)"

# ── 2. Dependencies ──────────────────────────────────────────────────────────
step "Installing dependencies"
printf '    %sthis takes a minute or two the first time%s\n' "$DIM" "$RESET"

# npm ci is faster and reproducible, but it requires the lockfile to be in sync
# with package.json. Fall back to install rather than failing the whole setup.
if [ -f package-lock.json ]; then
  npm ci --no-audit --no-fund >/dev/null 2>&1 || {
    warn "lockfile out of sync, falling back to npm install"
    npm install --no-audit --no-fund >/dev/null
  }
else
  npm install --no-audit --no-fund >/dev/null
fi
ok "dependencies installed"

# ── 3. Environment file ──────────────────────────────────────────────────────
step "Setting up your environment file"

if [ -f .env.local ]; then
  ok ".env.local already exists — leaving it alone"
elif [ -f .env.example ]; then
  cp .env.example .env.local
  ok "created .env.local from .env.example"
else
  # Belt and braces: the template is committed, but a stray .gitignore rule can
  # swallow dotfiles. Never fail setup over an optional key file.
  cat > .env.local <<'ENVEOF'
# Optional. Without a key the Terminal still works — it just answers in
# character instead of calling a real model. See README.
ANTHROPIC_API_KEY=
# TERMINAL_MODEL=claude-haiku-4-5-20251001
ENVEOF
  warn ".env.example was missing; wrote a minimal .env.local instead"
fi
printf '    %sThe site works fully without an API key. Add one to .env.local only if\n' "$DIM"
printf '    you want the Terminal app to talk to a real model.%s\n' "$RESET"

# ── 4. Telemetry ─────────────────────────────────────────────────────────────
step "Turning off Next.js telemetry"

# Next.js posts anonymous usage data to Vercel by default. This project is meant
# to run entirely offline, so opt out — it's the only thing left that would call
# out to the internet on its own.
if npx --no-install next telemetry disable >/dev/null 2>&1; then
  ok "telemetry disabled"
else
  warn "couldn't disable telemetry automatically (harmless — run 'npx next telemetry disable')"
fi

# ── 5. Images ────────────────────────────────────────────────────────────────
step "Checking placeholder art"

if [ -f public/images/portrait/self-portrait-placeholder.png ] &&
   [ -f public/images/brand/classic-mark.svg ]; then
  ok "art already generated"
else
  npm run placeholders >/dev/null
  npm run brand >/dev/null
  ok "generated placeholder art and brand marks"
fi

# ── 6. Sanity check ──────────────────────────────────────────────────────────
step "Checking the project compiles"

if npm run typecheck >/dev/null 2>&1; then
  ok "TypeScript is happy"
else
  warn "typecheck reported problems — run 'npm run typecheck' to see them"
fi

# ── done ─────────────────────────────────────────────────────────────────────
cat <<EOF

${GREEN}${BOLD}Setup complete.${RESET}

  ${BOLD}Start it:${RESET}   npm run dev
  ${BOLD}Then open:${RESET}  http://localhost:3000

  The site boots into a 1984 black-and-white machine. Wait a few seconds for the
  "Software Update" notice, click Install, and it hands off to the colour desktop.

  ${BOLD}Make it yours${RESET} — edit these, nothing else:
    content/bio.ts        your name, tagline, about, socials
    content/projects.ts   one entry per project (each becomes an app)
    content/facts.ts      the facts revealed by the Fact-sweeper game
    public/images/        drop in your own art, keep the filenames

EOF

if [ "$START_AFTER" -eq 1 ]; then
  step "Starting the dev server"
  exec npm run dev
fi
