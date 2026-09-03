#!/usr/bin/env bash
# Ananta CRM — first-time setup (Linux/macOS/Git Bash).
#
# Creates the Python venv, a fresh Postgres database + dedicated app user,
# runs migrations, seeds baseline RBAC/reference data, and installs frontend
# dependencies. Safe to re-run — it skips the database step entirely if
# backend/.env already exists, and everything else (venv, migrate, seed,
# npm install) is idempotent.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

echo "=== Ananta CRM setup ==="
echo

# --- Python: prefer the Windows "py" launcher. A bare "python" on a fresh
# Windows box can resolve to the Microsoft Store stub, which prints a install
# nag and does nothing useful — "py" is the one that reliably works there. ---
if command -v py >/dev/null 2>&1; then
  PYTHON_BIN="py"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
else
  echo "Python not found. Install Python 3.11+ and make sure it's on PATH." >&2
  exit 1
fi

command -v node >/dev/null 2>&1 || { echo "Node.js not found. Install Node.js 20+ and make sure it's on PATH." >&2; exit 1; }
command -v npm  >/dev/null 2>&1 || { echo "npm not found. It ships with Node.js — reinstall Node if it's missing." >&2; exit 1; }

# --- psql: a fresh Windows Postgres install frequently doesn't put this on
# PATH even though the installer asks. Fall back to the default install
# location before giving up. ---
PSQL_BIN=""
if command -v psql >/dev/null 2>&1; then
  PSQL_BIN="psql"
else
  for d in "/c/Program Files/PostgreSQL"/*; do
    [ -x "$d/bin/psql.exe" ] && PSQL_BIN="$d/bin/psql.exe"
  done
fi
if [ -z "$PSQL_BIN" ]; then
  echo "psql not found. Install PostgreSQL and make sure its bin/ folder is on PATH," >&2
  echo "or add it manually (typically C:\\Program Files\\PostgreSQL\\<version>\\bin)." >&2
  exit 1
fi

echo "--- Backend ---"
cd "$BACKEND_DIR"

if [ ! -d ".venv" ]; then
  "$PYTHON_BIN" -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/Scripts/activate 2>/dev/null || source .venv/bin/activate

python -m pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt

if [ ! -f ".env" ]; then
  echo
  echo "First-time database setup — this creates a fresh 'ananta_crm' database"
  echo "and a dedicated 'ananta_app' user (never your postgres superuser account)."
  read -rp "Postgres host [127.0.0.1]: " DB_HOST
  DB_HOST=${DB_HOST:-127.0.0.1}
  read -rp "Postgres superuser username [postgres]: " PG_SUPERUSER
  PG_SUPERUSER=${PG_SUPERUSER:-postgres}
  read -rsp "Postgres superuser password: " PG_SUPERUSER_PASS
  echo

  APP_DB_PASS=$("$PYTHON_BIN" -c "import secrets,string; print(''.join(secrets.choice(string.ascii_letters+string.digits) for _ in range(28)))")
  SECRET_KEY=$("$PYTHON_BIN" -c "import secrets; print(secrets.token_urlsafe(50))")

  export PGPASSWORD="$PG_SUPERUSER_PASS"
  "$PSQL_BIN" -U "$PG_SUPERUSER" -h "$DB_HOST" -v ON_ERROR_STOP=1 -c "CREATE DATABASE ananta_crm;"
  "$PSQL_BIN" -U "$PG_SUPERUSER" -h "$DB_HOST" -v ON_ERROR_STOP=1 -c "CREATE USER ananta_app WITH PASSWORD '$APP_DB_PASS';"
  "$PSQL_BIN" -U "$PG_SUPERUSER" -h "$DB_HOST" -v ON_ERROR_STOP=1 -c "ALTER DATABASE ananta_crm OWNER TO ananta_app;"
  "$PSQL_BIN" -U "$PG_SUPERUSER" -h "$DB_HOST" -v ON_ERROR_STOP=1 -d ananta_crm -c "GRANT ALL ON SCHEMA public TO ananta_app;"
  unset PGPASSWORD

  cat > .env <<EOF
DJANGO_SECRET_KEY=$SECRET_KEY
DJANGO_DEBUG=true
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1

DB_NAME=ananta_crm
DB_USER=ananta_app
DB_PASSWORD=$APP_DB_PASS
DB_HOST=$DB_HOST
DB_PORT=5432

CORS_ALLOWED_ORIGINS=http://localhost:3000
CSRF_TRUSTED_ORIGINS=http://localhost:3000
EOF
  echo "Created backend/.env"
else
  echo "backend/.env already exists — skipping database setup."
fi

python manage.py migrate
python manage.py seed_initial_data

HAS_SUPERUSER=$(python manage.py shell -c "from apps.accounts.models import User; print(User.objects.filter(is_superuser=True).exists())" 2>/dev/null | tail -1)
if [ "$HAS_SUPERUSER" != "True" ]; then
  echo
  echo "Create your admin login:"
  python manage.py createsuperuser
fi

echo
echo "--- Frontend ---"
cd "$FRONTEND_DIR"
npm install
if [ ! -f ".env.local" ]; then
  echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
fi

echo
echo "=== Setup complete ==="
echo "Run ./run.sh (or run.bat on Windows) to start the app."
