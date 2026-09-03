#!/usr/bin/env bash
# Ananta CRM — starts the backend and frontend dev servers together.
# Ctrl+C stops both, and everything either of them spawned, cleanly.
set -m  # give each backgrounded job its own process group, so killing the
        # group also kills whatever it spawned (Django's autoreloader child,
        # Next's Turbopack workers, etc.) instead of leaving orphans behind.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

if [ ! -d "$BACKEND_DIR/.venv" ] || [ ! -f "$BACKEND_DIR/.env" ]; then
  echo "Backend isn't set up yet. Run ./setup.sh first." >&2
  exit 1
fi

BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  echo
  echo "Stopping..."
  [ -n "$BACKEND_PID" ]  && kill -TERM -"$BACKEND_PID" 2>/dev/null
  [ -n "$FRONTEND_PID" ] && kill -TERM -"$FRONTEND_PID" 2>/dev/null
  wait 2>/dev/null
  echo "Stopped."
}
trap cleanup INT TERM

(
  cd "$BACKEND_DIR"
  # shellcheck disable=SC1091
  source .venv/Scripts/activate 2>/dev/null || source .venv/bin/activate
  exec python manage.py runserver 127.0.0.1:8000
) &
BACKEND_PID=$!

(
  cd "$FRONTEND_DIR"
  # Next.js's telemetry pings itself off via a deliberately detached helper
  # process that survives the parent dying (by design, so it can finish
  # flushing after exit) — harmless, but it'd otherwise linger for a few
  # seconds after Ctrl+C. Disabling telemetry for these dev runs skips it.
  export NEXT_TELEMETRY_DISABLED=1
  exec npm run dev
) &
FRONTEND_PID=$!

echo
echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:3000"
echo "Press Ctrl+C to stop."
echo

wait
