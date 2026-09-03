@echo off
setlocal enabledelayedexpansion

rem Ananta CRM - first-time setup (Windows).
rem
rem Creates the Python venv, a fresh Postgres database + dedicated app user,
rem runs migrations, seeds baseline RBAC/reference data, and installs
rem frontend dependencies. Safe to re-run - it skips the database step
rem entirely if backend\.env already exists.

set "SCRIPT_DIR=%~dp0"
set "ROOT_DIR=%SCRIPT_DIR%.."
set "BACKEND_DIR=%ROOT_DIR%\backend"
set "FRONTEND_DIR=%ROOT_DIR%\frontend"

echo === Ananta CRM setup ===
echo.

rem --- Python: prefer the "py" launcher. A bare "python" on a fresh Windows
rem box can resolve to the Microsoft Store stub, which prints an install nag
rem and does nothing useful - "py" is the one that reliably works. ---
where py >nul 2>&1
if not errorlevel 1 (
  set "PYTHON_CMD=py"
) else (
  where python >nul 2>&1
  if not errorlevel 1 (
    set "PYTHON_CMD=python"
  ) else (
    echo Python not found. Install Python 3.11+ and make sure it's on PATH.
    exit /b 1
  )
)

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js not found. Install Node.js 20+ and make sure it's on PATH.
  exit /b 1
)
where npm >nul 2>&1
if errorlevel 1 (
  echo npm not found. It ships with Node.js - reinstall Node if it's missing.
  exit /b 1
)

rem --- psql: a fresh Windows Postgres install frequently doesn't put this on
rem PATH even though the installer asks. Fall back to the default install
rem location before giving up. ---
set "PSQL_EXE="
where psql >nul 2>&1
if not errorlevel 1 (
  set "PSQL_EXE=psql"
) else (
  if exist "C:\Program Files\PostgreSQL" (
    for /f "delims=" %%D in ('dir /b /ad /o-n "C:\Program Files\PostgreSQL" 2^>nul') do (
      if not defined PSQL_EXE if exist "C:\Program Files\PostgreSQL\%%D\bin\psql.exe" set "PSQL_EXE=C:\Program Files\PostgreSQL\%%D\bin\psql.exe"
    )
  )
)
if not defined PSQL_EXE (
  echo psql not found. Install PostgreSQL and make sure its bin\ folder is on PATH,
  echo or add it manually ^(typically C:\Program Files\PostgreSQL\^<version^>\bin^).
  exit /b 1
)

echo --- Backend ---
cd /d "%BACKEND_DIR%"

if not exist ".venv" (
  %PYTHON_CMD% -m venv .venv
)
call ".venv\Scripts\activate.bat"

python -m pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt

if not exist ".env" (
  echo.
  echo First-time database setup - this creates a fresh 'ananta_crm' database
  echo and a dedicated 'ananta_app' user ^(never your postgres superuser account^).
  set /p "PG_HOST=Postgres host [127.0.0.1]: "
  if "!PG_HOST!"=="" set "PG_HOST=127.0.0.1"
  set /p "PG_SUPERUSER=Postgres superuser username [postgres]: "
  if "!PG_SUPERUSER!"=="" set "PG_SUPERUSER=postgres"

  for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "$p = Read-Host 'Postgres superuser password' -AsSecureString; [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToGlobalAllocUnicode($p))"`) do set "PG_SUPERUSER_PASS=%%P"

  for /f "usebackq delims=" %%P in (`python -c "import secrets,string; print(''.join(secrets.choice(string.ascii_letters+string.digits) for _ in range(28)))"`) do set "APP_DB_PASS=%%P"
  for /f "usebackq delims=" %%S in (`python -c "import secrets; print(secrets.token_urlsafe(50))"`) do set "DJANGO_SECRET=%%S"

  set "PGPASSWORD=!PG_SUPERUSER_PASS!"
  "!PSQL_EXE!" -U !PG_SUPERUSER! -h !PG_HOST! -v ON_ERROR_STOP=1 -c "CREATE DATABASE ananta_crm;"
  if errorlevel 1 goto :db_error
  "!PSQL_EXE!" -U !PG_SUPERUSER! -h !PG_HOST! -v ON_ERROR_STOP=1 -c "CREATE USER ananta_app WITH PASSWORD '!APP_DB_PASS!';"
  if errorlevel 1 goto :db_error
  "!PSQL_EXE!" -U !PG_SUPERUSER! -h !PG_HOST! -v ON_ERROR_STOP=1 -c "ALTER DATABASE ananta_crm OWNER TO ananta_app;"
  if errorlevel 1 goto :db_error
  "!PSQL_EXE!" -U !PG_SUPERUSER! -h !PG_HOST! -v ON_ERROR_STOP=1 -d ananta_crm -c "GRANT ALL ON SCHEMA public TO ananta_app;"
  if errorlevel 1 goto :db_error
  set "PGPASSWORD="

  (
    echo DJANGO_SECRET_KEY=!DJANGO_SECRET!
    echo DJANGO_DEBUG=true
    echo DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
    echo.
    echo DB_NAME=ananta_crm
    echo DB_USER=ananta_app
    echo DB_PASSWORD=!APP_DB_PASS!
    echo DB_HOST=!PG_HOST!
    echo DB_PORT=5432
    echo.
    echo CORS_ALLOWED_ORIGINS=http://localhost:3000
    echo CSRF_TRUSTED_ORIGINS=http://localhost:3000
  ) > .env
  echo Created backend\.env
) else (
  echo backend\.env already exists - skipping database setup.
)

python manage.py migrate
python manage.py seed_initial_data

set "HAS_SUPERUSER="
for /f "usebackq delims=" %%H in (`python manage.py shell -c "from apps.accounts.models import User; print(User.objects.filter(is_superuser=True).exists())"`) do set "HAS_SUPERUSER=%%H"
if not "!HAS_SUPERUSER!"=="True" (
  echo.
  echo Create your admin login:
  python manage.py createsuperuser
)

echo.
echo --- Frontend ---
cd /d "%FRONTEND_DIR%"
call npm install
if not exist ".env.local" (
  echo NEXT_PUBLIC_API_URL=http://localhost:8000> .env.local
)

echo.
echo === Setup complete ===
echo Run run.bat to start the app.
goto :eof

:db_error
echo.
echo Database setup failed. Check the Postgres username/password and try again.
set "PGPASSWORD="
exit /b 1
