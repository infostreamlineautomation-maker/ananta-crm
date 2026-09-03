@echo off
setlocal

rem Ananta CRM - starts the backend and frontend dev servers together.
rem Ctrl+C stops both, and everything either of them spawned, cleanly
rem (delegates the actual process management to PowerShell's Start-Process /
rem Wait-Process / taskkill /T, which reliably kills a whole process tree on
rem Windows - plain batch "start" has no good way to do that on its own).

set "SCRIPT_DIR=%~dp0"
set "ROOT_DIR=%SCRIPT_DIR%.."
set "BACKEND_DIR=%ROOT_DIR%\backend"
set "FRONTEND_DIR=%ROOT_DIR%\frontend"

if not exist "%BACKEND_DIR%\.venv" (
  echo Backend isn't set up yet. Run setup.bat first.
  exit /b 1
)
if not exist "%BACKEND_DIR%\.env" (
  echo Backend isn't set up yet. Run setup.bat first.
  exit /b 1
)

echo.
echo Starting Ananta CRM. Press Ctrl+C to stop.

rem NOTE: deliberately NOT setting $ErrorActionPreference = 'Stop' below.
rem In Windows PowerShell 5.1, a native command's stderr (taskkill's included)
rem gets wrapped as a terminating error under ErrorActionPreference=Stop even
rem when redirected to $null - which would abort the finally block after the
rem first taskkill call (e.g. if the backend already exited on its own) and
rem skip killing the frontend tree entirely. Start-Process itself already
rem throws on a real failure (bad path, missing exe) regardless of preference,
rem so nothing is lost by leaving the default here.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$backendDir = '%BACKEND_DIR%'; $frontendDir = '%FRONTEND_DIR%';" ^
  "$py = Join-Path $backendDir '.venv\Scripts\python.exe';" ^
  "$backend = Start-Process -FilePath $py -ArgumentList 'manage.py','runserver','127.0.0.1:8000' -WorkingDirectory $backendDir -PassThru -NoNewWindow -ErrorAction Stop;" ^
  "$env:NEXT_TELEMETRY_DISABLED = '1';" ^
  "$frontend = Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev' -WorkingDirectory $frontendDir -PassThru -NoNewWindow -ErrorAction Stop;" ^
  "Write-Host ''; Write-Host 'Backend:  http://localhost:8000'; Write-Host 'Frontend: http://localhost:3000'; Write-Host '';" ^
  "try { Wait-Process -Id $backend.Id, $frontend.Id } finally { Write-Host ''; Write-Host 'Stopping...'; taskkill /PID $backend.Id /T /F 2>$null; taskkill /PID $frontend.Id /T /F 2>$null; Write-Host 'Stopped.' }"

endlocal
